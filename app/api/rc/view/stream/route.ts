import { dbQuery } from "@/lib/server/db"
import { ExternalApiError, lookupRc, normalizeRegistration, storeRcResult, type RcLookupProgressEvent } from "@/lib/server/rc-lookup"
import { checkFinvedexOrderStatus, makeFinvedexOrderId } from "@/lib/server/finvedex"

const encoder = new TextEncoder()

function writeEvent(controller: ReadableStreamDefaultController, event: string, data: any) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
}

function userFacingError(status: number, internalMessage: string): string {
  if (status === 404) return "Vehicle registration not found. Please check the number and try again."
  if (status === 503) return "Our servers are temporarily busy. Please try again in a few minutes."
  if (status === 402) return internalMessage
  console.error("[rc-view-stream]", internalMessage)
  return "Unable to fetch RC details right now. Please try again later."
}

function providerIndexToStepIndex(providerIndex: number) {
  if (providerIndex === 1) return 0
  return 1
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const transactionId = url.searchParams.get("transactionId") || ""
  const registrationParam = normalizeRegistration(url.searchParams.get("registration") || "")
  const freshParam = (url.searchParams.get("fresh") || "").trim().toLowerCase()
  const bypassCache = freshParam === "1" || freshParam === "true" || freshParam === "yes"

  const stream = new ReadableStream({
    async start(controller) {
      // Prevent browser EventSource from auto-reconnecting after the stream closes
      controller.enqueue(encoder.encode("retry: 9999999\n\n"))
      try {
        if (!transactionId) {
          writeEvent(controller, "server_error", { ok: false, error: "Missing transactionId", status: 400 })
          return
        }

        const txns = await dbQuery<{
          id: string
          user_id: string | null
          type: "recharge" | "download"
          status: "pending" | "completed" | "failed"
          registration_number: string | null
        }>("SELECT id, user_id, type, status, registration_number FROM transactions WHERE id = ? LIMIT 1", [transactionId])

        let txn = txns[0]

        // Transaction not in DB — common when DB insert failed after Finvedex payment succeeded.
        // Verify with Finvedex directly and use the registration from the URL param.
        if (!txn) {
          if (!registrationParam) {
            writeEvent(controller, "server_error", { ok: false, error: "Invalid transaction", status: 404 })
            return
          }
          const orderId = makeFinvedexOrderId(transactionId)
          const finvedexStatus = await checkFinvedexOrderStatus(orderId).catch(() => "pending" as const)
          if (finvedexStatus !== "completed") {
            writeEvent(controller, "server_error", {
              ok: false,
              error: "Payment pending. RC will be available after confirmation.",
              status: 402,
            })
            return
          }
          // Payment confirmed — insert a completed transaction record so future calls work
          await dbQuery(
            "INSERT IGNORE INTO transactions (id, user_id, type, amount, status, payment_method, description, registration_number) VALUES (?, NULL, 'download', 0, 'completed', 'finvedex', ?, ?)",
            [transactionId, `RC Download - ${registrationParam}`, registrationParam],
          ).catch(() => {})
          // Use a synthetic txn so the lookup proceeds
          txn = { id: transactionId, user_id: null, type: "download", status: "completed", registration_number: registrationParam }
        }

        if (txn.type !== "download" || !txn.registration_number) {
          writeEvent(controller, "server_error", { ok: false, error: "Invalid transaction", status: 404 })
          return
        }

        if (txn.status !== "completed") {
          writeEvent(controller, "server_error", {
            ok: false,
            error: "Payment pending. RC will be available after confirmation.",
            status: 402,
          })
          return
        }

        const result = await lookupRc(txn.registration_number, {
          userId: txn.user_id ?? null,
          bypassCache,
          onProgress: (event: RcLookupProgressEvent) => {
            if (event.type === "provider_attempt") {
              writeEvent(controller, "progress", { stepIndex: providerIndexToStepIndex(event.providerIndex), state: "active" })
            } else if (event.type === "provider_failed") {
              writeEvent(controller, "progress", { stepIndex: providerIndexToStepIndex(event.providerIndex), state: "failure" })
            } else if (event.type === "provider_succeeded") {
              writeEvent(controller, "progress", { stepIndex: providerIndexToStepIndex(event.providerIndex), state: "success" })
            } else if (event.type === "cache_hit" || event.type === "mock_hit") {
              writeEvent(controller, "progress", { stepIndex: 0, state: "success" })
            }
          },
        })

        if (!result) {
          writeEvent(controller, "not_found", { ok: false, error: "Not found", status: 404 })
          return
        }

        await storeRcResult(result.registrationNumber, txn.user_id ?? null, result.data, result.provider, result.providerRef).catch(() => {})
        writeEvent(controller, "done", {
          ok: true,
          registrationNumber: result.registrationNumber,
          data: result.data,
          provider: result.provider,
        })
      } catch (error: any) {
        if (error instanceof ExternalApiError) {
          const status =
            error.status === 404 ? 404 : error.status === 503 ? 503 : error.status === 401 || error.status === 403 ? 502 : 502
          writeEvent(controller, "server_error", { ok: false, error: userFacingError(status, error.message), status })
        } else {
          console.error("[rc-view-stream]", error?.message || "Lookup failed")
          writeEvent(controller, "server_error", { ok: false, error: "Unable to fetch RC details right now. Please try again later.", status: 500 })
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  })
}

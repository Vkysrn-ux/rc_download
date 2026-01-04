import { dbQuery } from "@/lib/server/db"
import { ExternalApiError, lookupRc, storeRcResult, type RcLookupProgressEvent } from "@/lib/server/rc-lookup"

const encoder = new TextEncoder()

function writeEvent(controller: ReadableStreamDefaultController, event: string, data: any) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
}

function providerIndexToStepIndex(providerIndex: number) {
  if (providerIndex === 1) return 0
  if (providerIndex === 4) return 1
  return 0
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const transactionId = url.searchParams.get("transactionId") || ""
  const freshParam = (url.searchParams.get("fresh") || "").trim().toLowerCase()
  const bypassCache = freshParam === "1" || freshParam === "true" || freshParam === "yes"

  const stream = new ReadableStream({
    async start(controller) {
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

        const txn = txns[0]
        if (!txn || txn.type !== "download" || !txn.registration_number) {
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
          providerRef: result.providerRef,
        })
      } catch (error: any) {
        if (error instanceof ExternalApiError) {
          const status =
            error.status === 404 ? 404 : error.status === 503 ? 503 : error.status === 401 || error.status === 403 ? 502 : 502
          writeEvent(controller, "server_error", { ok: false, error: error.message, status })
        } else {
          writeEvent(controller, "server_error", { ok: false, error: error?.message || "Lookup failed", status: 500 })
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

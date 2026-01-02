import { dbQuery } from "@/lib/server/db"
import { getCurrentUser } from "@/lib/server/session"
import { ExternalApiError, lookupRc, normalizeRegistration, storeRcResult, type RcLookupProgressEvent } from "@/lib/server/rc-lookup"

const USER_PRICE = 20

const encoder = new TextEncoder()

function writeEvent(controller: ReadableStreamDefaultController, event: string, data: any) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
}

function providerIndexToStepIndex(providerIndex: number) {
  if (providerIndex >= 1 && providerIndex <= 4) return providerIndex - 1
  return 0
}

async function hasPurchased(userId: string, registrationNumber: string) {
  const rows = await dbQuery<{ id: string }>(
    "SELECT id FROM transactions WHERE user_id = ? AND type = 'download' AND status = 'completed' AND registration_number = ? LIMIT 1",
    [userId, registrationNumber],
  )
  return Boolean(rows[0]?.id)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const reg = url.searchParams.get("registrationNumber")

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!reg) {
          writeEvent(controller, "server_error", { ok: false, error: "Missing registrationNumber", status: 400 })
          return
        }

        const registrationNumber = normalizeRegistration(reg)
        const user = await getCurrentUser().catch(() => null)

        if (user) {
          const balances = await dbQuery<{ wallet_balance: string | number }>(
            "SELECT wallet_balance FROM users WHERE id = ? LIMIT 1",
            [user.id],
          )
          const walletBalance = Number(balances[0]?.wallet_balance ?? 0)
          if (walletBalance < USER_PRICE && !(await hasPurchased(user.id, registrationNumber))) {
            writeEvent(controller, "server_error", { ok: false, error: "Insufficient wallet balance. Please pay to view RC.", status: 402 })
            return
          }
        }

        const result = await lookupRc(registrationNumber, {
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

        await storeRcResult(result.registrationNumber, user?.id ?? null, result.data, result.provider, result.providerRef).catch(() => {})
        writeEvent(controller, "done", {
          ok: true,
          registrationNumber: result.registrationNumber,
          data: result.data,
          provider: result.provider,
          providerRef: result.providerRef,
        })
      } catch (error: any) {
        if (error instanceof ExternalApiError) {
          const status = error.status === 404 ? 404 : error.status === 401 || error.status === 403 ? 502 : 502
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

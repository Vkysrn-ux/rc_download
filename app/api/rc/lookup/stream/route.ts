import { dbQuery } from "@/lib/server/db"
import { getCurrentUser } from "@/lib/server/session"
import { ExternalApiError, lookupRc, normalizeRegistration, storeRcResult, type RcLookupProgressEvent } from "@/lib/server/rc-lookup"
import { WalletError, chargeWalletForDownload } from "@/lib/server/wallet"
import { REGISTERED_RC_DOWNLOAD_PRICE_INR } from "@/lib/pricing"

const encoder = new TextEncoder()

function writeEvent(controller: ReadableStreamDefaultController, event: string, data: any) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
}

function providerIndexToStepIndex(providerIndex: number) {
  if (providerIndex === 1) return 0
  return 1
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const reg = url.searchParams.get("registrationNumber")
  const freshParam = (url.searchParams.get("fresh") || "").trim().toLowerCase()
  const bypassCache = freshParam === "1" || freshParam === "true" || freshParam === "yes"

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
          if (walletBalance < REGISTERED_RC_DOWNLOAD_PRICE_INR) {
            writeEvent(controller, "server_error", { ok: false, error: "Insufficient wallet balance. Please top up via Cashfree.", status: 402 })
            return
          }
        }

        const result = await lookupRc(registrationNumber, {
          userId: user?.id ?? null,
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

        await storeRcResult(result.registrationNumber, user?.id ?? null, result.data, result.provider, result.providerRef).catch(() => {})

        if (user) {
          try {
            const charged = await chargeWalletForDownload({
              userId: user.id,
              registrationNumber: result.registrationNumber,
              price: REGISTERED_RC_DOWNLOAD_PRICE_INR,
              description: `Vehicle RC Download - ${result.registrationNumber}`,
            })
            writeEvent(controller, "done", {
              ok: true,
              registrationNumber: result.registrationNumber,
              transactionId: charged.transactionId,
              walletCharged: true,
              walletBalance: charged.walletBalance,
              data: result.data,
              provider: result.provider,
            })
          } catch (error: any) {
            if (error instanceof WalletError) {
              writeEvent(controller, "server_error", { ok: false, error: error.message, status: error.status })
            } else {
              writeEvent(controller, "server_error", { ok: false, error: "Unable to charge wallet", status: 500 })
            }
          }
        } else {
          // Do not leak RC data to unauthenticated users; require payment to view/download.
          writeEvent(controller, "done", {
            ok: true,
            registrationNumber: result.registrationNumber,
            paymentRequired: true,
            provider: result.provider,
          })
        }
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

import crypto from "crypto"

export function getFinvedexConfig() {
  const apiKey = process.env.FINVEDEX_API_KEY
  const apiSecret = process.env.FINVEDEX_API_SECRET
  if (!apiKey || !apiSecret) throw new Error("Missing required env vars: FINVEDEX_API_KEY / FINVEDEX_API_SECRET")
  return { apiKey, apiSecret }
}

export function makeFinvedexOrderId(transactionId: string) {
  return `rc${transactionId.replace(/-/g, "").slice(0, 18)}`
}

function finvedexHeaders() {
  const { apiKey, apiSecret } = getFinvedexConfig()
  return {
    "X-API-Key": apiKey,
    "X-API-Secret": apiSecret,
    "Content-Type": "application/json",
  }
}

export async function createFinvedexOrder(params: {
  customerMobile: string
  customerName?: string
  amount: number
  orderId: string
  redirectUrl: string
  description?: string
}): Promise<{ paymentUrl: string; raw: Record<string, unknown> }> {
  const body = JSON.stringify({
    amount: String(params.amount),
    order_id: params.orderId,
    customer_name: params.customerName || "Customer",
    customer_mobile: params.customerMobile,
    description: params.description || params.orderId,
    callback_url: params.redirectUrl,
  })

  const res = await fetch("https://www.finvedex.com/api/create-order", {
    method: "POST",
    headers: finvedexHeaders(),
    body,
  })

  const text = await res.text().catch(() => "")
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not JSON */ }

  console.log("[finvedex create-order] status:", res.status, "raw:", text.slice(0, 500))

  if (!json) throw new Error(`Finvedex returned non-JSON: ${text.slice(0, 200)}`)

  if (!res.ok || json?.status === "error" || json?.status === false) {
    throw new Error(json?.message || json?.error || `Finvedex error ${res.status}: ${text.slice(0, 200)}`)
  }

  const paymentUrl = json?.payment_url || json?.paymentUrl || json?.data?.payment_url || ""

  if (!paymentUrl) {
    throw new Error(`Finvedex did not return a payment URL. Response: ${JSON.stringify(json).slice(0, 300)}`)
  }

  return { paymentUrl, raw: json }
}

export async function checkFinvedexOrderStatus(orderId: string): Promise<"completed" | "pending" | "failed"> {
  try {
    const res = await fetch("https://www.finvedex.com/api/check-status", {
      method: "POST",
      headers: finvedexHeaders(),
      body: JSON.stringify({ order_id: orderId }),
    })

    const json = await res.json().catch(() => null)
    console.log("[finvedex check-status] orderId:", orderId, "response:", JSON.stringify(json).slice(0, 200))

    const status = String(json?.payment_status || json?.status || "").toUpperCase()

    if (status === "SUCCESS" || status === "COMPLETED" || status === "PAID") return "completed"
    if (status === "FAILED" || status === "FAILURE" || status === "CANCELLED" || status === "ERROR") return "failed"
    return "pending"
  } catch {
    return "pending"
  }
}

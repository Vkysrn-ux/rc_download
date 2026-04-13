import crypto from "crypto"

export function getFinvedexConfig() {
  const token = process.env.FINVEDEX_API_TOKEN
  if (!token) throw new Error("Missing required env var: FINVEDEX_API_TOKEN")
  return { token }
}

export function makeFinvedexOrderId(transactionId: string) {
  // Finvedex order_id — keep it short and alphanumeric
  return `rc${transactionId.replace(/-/g, "").slice(0, 18)}`
}

export async function createFinvedexOrder(params: {
  customerMobile: string
  amount: number
  orderId: string
  redirectUrl: string
  remark1?: string
  remark2?: string
}): Promise<{ paymentUrl: string; raw: Record<string, unknown> }> {
  const { token } = getFinvedexConfig()

  const body = new URLSearchParams({
    customer_mobile: params.customerMobile,
    user_token: token,
    amount: String(params.amount),
    order_id: params.orderId,
    redirect_url: params.redirectUrl,
    remark1: params.remark1 || "",
    remark2: params.remark2 || "",
  })

  const res = await fetch("https://finvedex.com/api/create-order", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok || !json) {
    throw new Error(json?.message || json?.error || `Finvedex error ${res.status}`)
  }

  // Common response shapes: { status, payment_url } or { data: { payment_url } }
  const paymentUrl =
    json?.payment_url ||
    json?.data?.payment_url ||
    json?.paymentUrl ||
    json?.redirect_url ||
    json?.url ||
    ""

  if (!paymentUrl) {
    throw new Error(json?.message || "Finvedex did not return a payment URL")
  }

  return { paymentUrl, raw: json }
}

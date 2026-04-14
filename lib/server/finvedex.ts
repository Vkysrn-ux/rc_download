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

  const text = await res.text().catch(() => "")
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not JSON */ }

  console.log("[finvedex create-order] status:", res.status, "raw:", text.slice(0, 500))

  if (!json) {
    throw new Error(`Finvedex returned non-JSON: ${text.slice(0, 200)}`)
  }

  // Finvedex returns HTTP 200 even for errors — check status field
  if (!res.ok || json?.status === false) {
    throw new Error(json?.message || json?.error || `Finvedex error ${res.status}: ${text.slice(0, 200)}`)
  }

  // Log all top-level keys so we can find the correct payment URL field
  console.log("[finvedex create-order] response keys:", Object.keys(json))

  const paymentUrl =
    json?.result?.payment_url ||
    json?.payment_url ||
    json?.data?.payment_url ||
    json?.paymentUrl ||
    json?.redirect_url ||
    json?.url ||
    json?.payment_link ||
    json?.link ||
    json?.data?.url ||
    json?.data?.link ||
    json?.data?.redirect_url ||
    ""

  if (!paymentUrl) {
    throw new Error(`Finvedex did not return a payment URL. Response: ${JSON.stringify(json).slice(0, 300)}`)
  }

  return { paymentUrl, raw: json }
}

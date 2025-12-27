import crypto from "crypto"

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export function getRazorpayConfig() {
  const keyId = required("RAZORPAY_KEY_ID")
  const keySecret = required("RAZORPAY_KEY_SECRET")
  return { keyId, keySecret }
}

export function verifyRazorpaySignature(params: {
  orderId: string
  paymentId: string
  signature: string
}) {
  const { keySecret } = getRazorpayConfig()
  const payload = `${params.orderId}|${params.paymentId}`
  const expected = crypto.createHmac("sha256", keySecret).update(payload).digest("hex")
  if (!params.signature || params.signature.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature))
}

export async function razorpayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { keyId, keySecret } = getRazorpayConfig()
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64")
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const message =
      typeof json === "object" && json
        ? json?.error?.description || json?.error?.code || res.statusText
        : res.statusText
    throw new Error(`Razorpay ${res.status}: ${message}`)
  }
  return json as T
}

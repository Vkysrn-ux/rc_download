function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export type CashfreeMode = "sandbox" | "production"

export function getCashfreeConfig() {
  const clientId = required("CASHFREE_CLIENT_ID")
  const clientSecret = required("CASHFREE_CLIENT_SECRET")
  const mode: CashfreeMode = (process.env.CASHFREE_ENV ?? "").toLowerCase() === "production" ? "production" : "sandbox"
  const apiVersion = process.env.CASHFREE_API_VERSION || "2023-08-01"
  const baseUrl = mode === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com"
  return { clientId, clientSecret, mode, apiVersion, baseUrl }
}

export async function cashfreeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { clientId, clientSecret, apiVersion, baseUrl } = getCashfreeConfig()
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
      "x-api-version": apiVersion,
      accept: "application/json",
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const message =
      typeof json === "object" && json
        ? (json as any)?.message || (json as any)?.error || (json as any)?.type || res.statusText
        : res.statusText
    throw new Error(`Cashfree ${res.status}: ${message}`)
  }
  return json as T
}


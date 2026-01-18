import { NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"
import { ExternalApiError, normalizeRegistration } from "@/lib/server/rc-lookup"
import { WalletError, chargeWalletForDownload } from "@/lib/server/wallet"
import { REGISTERED_RC_OWNER_HISTORY_PRICE_INR } from "@/lib/pricing"

const LookupSchema = z.object({ registrationNumber: z.string().min(4).max(32) })

function parseJsonRecord(value: string | undefined, label: string): Record<string, string> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn(`[owner-history] ${label} must be a JSON object`)
      return null
    }
    const record: Record<string, string> = {}
    for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (entry === null || entry === undefined) continue
      if (typeof entry === "string") record[key] = entry
      else if (typeof entry === "number" || typeof entry === "boolean") record[key] = String(entry)
    }
    return Object.keys(record).length ? record : null
  } catch (error) {
    console.warn(`[owner-history] Invalid ${label}: ${(error as Error)?.message || "unable to parse JSON"}`)
    return null
  }
}

function normalizeHttpMethod(value: string | undefined): "GET" | "POST" {
  const method = (value || "").trim().toUpperCase()
  return method === "GET" ? "GET" : "POST"
}

function shouldTreatAsSuccess(payload: any) {
  if (!payload || typeof payload !== "object") return true
  const root = payload as Record<string, any>
  if (typeof root.ok === "boolean") return root.ok
  if (typeof root.success === "boolean") return root.success
  if (typeof root.error === "string" && root.error.trim()) return false

  const status = typeof root.status === "string" ? root.status.trim().toUpperCase() : null
  if (status && ["FAILED", "FAIL", "ERROR", "INVALID"].includes(status)) return false
  return true
}

async function fetchOwnerHistory(registrationNumber: string) {
  const urlRaw = (process.env.RC_OWNER_HISTORY_API_URL || "").trim()
  if (!urlRaw) throw new ExternalApiError(501, "Owner history API not configured")

  const method = normalizeHttpMethod(process.env.RC_OWNER_HISTORY_API_METHOD)
  const payloadField = (process.env.RC_OWNER_HISTORY_API_PAYLOAD_FIELD || "vrn").trim() || "vrn"

  const authHeaderName = (process.env.RC_OWNER_HISTORY_API_AUTH_HEADER_NAME || "authorization").trim() || "authorization"
  const authSchemeRaw = process.env.RC_OWNER_HISTORY_API_AUTH_SCHEME
  const authScheme = authSchemeRaw === undefined ? "Bearer" : authSchemeRaw.trim()
  const apiKey = (process.env.RC_OWNER_HISTORY_API_KEY || "").trim()

  const extraHeaders = parseJsonRecord(process.env.RC_OWNER_HISTORY_API_HEADERS, "RC_OWNER_HISTORY_API_HEADERS")
  const extraParams = parseJsonRecord(process.env.RC_OWNER_HISTORY_API_EXTRA_PARAMS, "RC_OWNER_HISTORY_API_EXTRA_PARAMS")

  const headers: Record<string, string> = {
    ...(extraHeaders || {}),
  }
  if (apiKey) {
    headers[authHeaderName] = authScheme ? `${authScheme} ${apiKey}` : apiKey
  }

  let requestUrl = urlRaw
  let body: string | undefined

  if (method === "GET") {
    const url = new URL(urlRaw)
    url.searchParams.set(payloadField, registrationNumber)
    if (extraParams) {
      for (const [key, value] of Object.entries(extraParams)) url.searchParams.set(key, value)
    }
    requestUrl = url.toString()
  } else {
    headers["content-type"] = headers["content-type"] || "application/json"
    body = JSON.stringify({ ...(extraParams || {}), [payloadField]: registrationNumber })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(requestUrl, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: controller.signal,
    })

    const text = await res.text().catch(() => "")
    const json = text ? JSON.parse(text) : null
    if (!res.ok) {
      const msg =
        (json && (json.error || json.message)) ||
        (text && text.slice(0, 200)) ||
        "Owner history lookup failed"
      throw new ExternalApiError(res.status, String(msg))
    }

    if (!shouldTreatAsSuccess(json)) {
      const msg = (json && (json.error || json.message)) || "Owner history lookup failed"
      throw new ExternalApiError(502, String(msg))
    }

    return json
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new ExternalApiError(504, "Owner history request timed out")
    }
    if (error instanceof SyntaxError) {
      throw new ExternalApiError(502, "Owner history API returned invalid JSON")
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

async function handleRequest(registrationNumberRaw: string) {
  const registrationNumber = normalizeRegistration(registrationNumberRaw)
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const balances = await dbQuery<{ wallet_balance: string | number }>(
    "SELECT wallet_balance FROM users WHERE id = ? LIMIT 1",
    [user.id],
  )
  const walletBalance = Number(balances[0]?.wallet_balance ?? 0)
  if (walletBalance < REGISTERED_RC_OWNER_HISTORY_PRICE_INR) {
    return NextResponse.json({ ok: false, error: "Insufficient wallet balance." }, { status: 402 })
  }

  const data = await fetchOwnerHistory(registrationNumber)

  const chargeWallet =
    ((process.env.RC_OWNER_HISTORY_CHARGE_WALLET || "1").trim().toLowerCase() || "1") !== "0"

  if (!chargeWallet) {
    return NextResponse.json({
      ok: true,
      registrationNumber,
      walletCharged: false,
      walletBalance,
      data,
    })
  }

  const charged = await chargeWalletForDownload({
    userId: user.id,
    registrationNumber,
    price: REGISTERED_RC_OWNER_HISTORY_PRICE_INR,
    description: `RC Owner History - ${registrationNumber}`,
  })

  return NextResponse.json({
    ok: true,
    registrationNumber,
    transactionId: charged.transactionId,
    walletCharged: true,
    walletBalance: charged.walletBalance,
    data,
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const reg = url.searchParams.get("registrationNumber")
  if (!reg) return NextResponse.json({ ok: false, error: "Missing registrationNumber" }, { status: 400 })

  try {
    return await handleRequest(reg)
  } catch (error: any) {
    if (error instanceof WalletError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }
    if (error instanceof ExternalApiError) {
      const status =
        error.status === 404 ? 404 : error.status === 503 ? 503 : error.status === 401 || error.status === 403 ? 502 : 502
      return NextResponse.json({ ok: false, error: error.message }, { status })
    }
    return NextResponse.json({ ok: false, error: error?.message || "Lookup failed" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = LookupSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  try {
    return await handleRequest(parsed.data.registrationNumber)
  } catch (error: any) {
    if (error instanceof WalletError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }
    if (error instanceof ExternalApiError) {
      const status =
        error.status === 404 ? 404 : error.status === 503 ? 503 : error.status === 401 || error.status === 403 ? 502 : 502
      return NextResponse.json({ ok: false, error: error.message }, { status })
    }
    return NextResponse.json({ ok: false, error: error?.message || "Lookup failed" }, { status: 500 })
  }
}


import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { readFileSync } from "fs"

import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"
import { ExternalApiError } from "@/lib/server/rc-lookup"
import { WalletError, chargeWalletForDownload } from "@/lib/server/wallet"
import { getPanDetailsPriceInr, REGISTERED_PAN_DETAILS_PRICE_INR } from "@/lib/pricing"

const LookupSchema = z.object({
  panNumber: z.string().min(5).max(32),
  transactionId: z.string().uuid().optional(),
})

function normalizePan(value: string) {
  return (value || "").toUpperCase().replace(/\s/g, "")
}

const PUBLIC_KEY_CACHE = new Map<string, string>()

function normalizePemValue(value: string) {
  return value.replace(/\\n/g, "\n").trim()
}

function loadPublicKeyPem(publicKeyPath?: string | null, publicKeyInline?: string | null) {
  const inline = normalizePemValue(publicKeyInline || "")
  if (inline) return inline
  const path = (publicKeyPath || "").trim()
  if (!path) return null
  const cached = PUBLIC_KEY_CACHE.get(path)
  if (cached) return cached
  try {
    const pem = readFileSync(path, "utf8")
    PUBLIC_KEY_CACHE.set(path, pem)
    return pem
  } catch (error) {
    console.error(`[pan-details] Failed to read public key at ${path}: ${(error as Error)?.message || "unknown error"}`)
    return null
  }
}

function generateCashfreeVrsSignature(clientId: string, publicKeyPath?: string | null, publicKeyInline?: string | null) {
  const publicKeyPem = loadPublicKeyPem(publicKeyPath, publicKeyInline)
  if (!publicKeyPem) return null

  try {
    const timestamp = Math.floor(Date.now() / 1000)
    const data = `${clientId}.${timestamp}`
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(data, "utf8"),
    )
    return { signature: encrypted.toString("base64"), timestamp }
  } catch (error) {
    console.error(`[pan-details] Cashfree signature generation failed: ${(error as Error)?.message || "unknown error"}`)
    return null
  }
}

function generateNumericReferenceId() {
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0")
  return `${Date.now()}${random}`
}

function parseJsonRecord(value: string | undefined, label: string): Record<string, string> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn(`[pan-details] ${label} must be a JSON object`)
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
    console.warn(`[pan-details] Invalid ${label}: ${(error as Error)?.message || "unable to parse JSON"}`)
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

async function fetchPanDetails(panNumber: string) {
  const urlRaw = (process.env.PAN_DETAILS_API_URL || "").trim()
  if (!urlRaw) throw new ExternalApiError(501, "PAN details API not configured")

  const method = normalizeHttpMethod(process.env.PAN_DETAILS_API_METHOD)
  const payloadField = (process.env.PAN_DETAILS_API_PAYLOAD_FIELD || "pan").trim() || "pan"

  const authHeaderName = (process.env.PAN_DETAILS_API_AUTH_HEADER_NAME || "authorization").trim() || "authorization"
  const authSchemeRaw = process.env.PAN_DETAILS_API_AUTH_SCHEME
  const authScheme = authSchemeRaw === undefined ? "Bearer" : authSchemeRaw.trim()
  const apiKey = (process.env.PAN_DETAILS_API_KEY || "").trim()

  const signatureHeaderName = (process.env.PAN_DETAILS_API_SIGNATURE_HEADER_NAME || "").trim() || ""
  const signatureTimestampHeaderName = (process.env.PAN_DETAILS_API_SIGNATURE_TIMESTAMP_HEADER_NAME || "").trim() || ""
  const signaturePublicKeyInline = (process.env.PAN_DETAILS_API_SIGNATURE_PUBLIC_KEY || "").trim()
  const signaturePublicKeyPath = (process.env.PAN_DETAILS_API_SIGNATURE_PUBLIC_KEY_PATH || "").trim()

  const extraHeaders = parseJsonRecord(process.env.PAN_DETAILS_API_HEADERS, "PAN_DETAILS_API_HEADERS")
  const extraParams = parseJsonRecord(process.env.PAN_DETAILS_API_EXTRA_PARAMS, "PAN_DETAILS_API_EXTRA_PARAMS")

  const headers: Record<string, string> = {
    ...(extraHeaders || {}),
  }
  if (apiKey) {
    headers[authHeaderName] = authScheme ? `${authScheme} ${apiKey}` : apiKey
  }

  if (signaturePublicKeyInline || signaturePublicKeyPath) {
    if (!apiKey) throw new ExternalApiError(500, "PAN details API key missing for signature")
    if (!signatureHeaderName) throw new ExternalApiError(500, "PAN details signature header name missing")
    const signature = generateCashfreeVrsSignature(apiKey, signaturePublicKeyPath || null, signaturePublicKeyInline || null)
    if (!signature) throw new ExternalApiError(500, "PAN signature generation failed")
    headers[signatureHeaderName] = signature.signature
    if (signatureTimestampHeaderName) {
      headers[signatureTimestampHeaderName] = String(signature.timestamp)
    }
  }

  let requestUrl = urlRaw
  let body: string | undefined

  if (method === "GET") {
    const url = new URL(urlRaw)
    url.searchParams.set(payloadField, panNumber)
    if (extraParams) {
      for (const [key, value] of Object.entries(extraParams)) url.searchParams.set(key, value)
    }
    requestUrl = url.toString()
  } else {
    headers["content-type"] = headers["content-type"] || "application/json"
    const payload: Record<string, unknown> = { ...(extraParams || {}), [payloadField]: panNumber }
    const referenceIdValue = payload["reference_id"]
    if (typeof referenceIdValue === "string" && (!referenceIdValue.trim() || referenceIdValue.trim().toUpperCase() === "AUTO")) {
      payload["reference_id"] = generateNumericReferenceId()
    }
    const verificationIdValue = payload["verification_id"]
    if (
      typeof verificationIdValue === "string" &&
      (!verificationIdValue.trim() || verificationIdValue.trim().toUpperCase() === "AUTO")
    ) {
      payload["verification_id"] = generateNumericReferenceId()
    }
    body = JSON.stringify(payload)
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
      const msg = (json && (json.error || json.message)) || (text && text.slice(0, 200)) || "PAN lookup failed"
      throw new ExternalApiError(res.status, String(msg))
    }

    if (!shouldTreatAsSuccess(json)) {
      const msg = (json && (json.error || json.message)) || "PAN lookup failed"
      throw new ExternalApiError(502, String(msg))
    }

    return json
  } catch (error: any) {
    if (error?.name === "AbortError") throw new ExternalApiError(504, "PAN request timed out")
    if (error instanceof SyntaxError) throw new ExternalApiError(502, "PAN API returned invalid JSON")
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

async function verifyGuestPayment(transactionId: string, panNumber: string) {
  const rows = await dbQuery<{
    id: string
    user_id: string | null
    type: "recharge" | "download"
    amount: string | number
    status: "pending" | "completed" | "failed"
    payment_method: "wallet" | "upi" | "razorpay" | "cashfree" | null
    registration_number: string | null
  }>(
    "SELECT id, user_id, type, amount, status, payment_method, registration_number FROM transactions WHERE id = ? LIMIT 1",
    [transactionId],
  )
  const txn = rows[0]
  if (!txn) throw new ExternalApiError(404, "Transaction not found")
  if (txn.user_id) throw new ExternalApiError(403, "Invalid transaction")
  if (txn.type !== "download") throw new ExternalApiError(403, "Invalid transaction")
  if (txn.payment_method !== "cashfree") throw new ExternalApiError(403, "Invalid transaction")
  if (txn.status !== "completed") throw new ExternalApiError(402, "Payment not completed")

  const expected = getPanDetailsPriceInr(true)
  const amount = Math.abs(Number(txn.amount))
  if (amount !== expected) throw new ExternalApiError(400, "Amount mismatch")

  const stored = normalizePan(String(txn.registration_number || ""))
  if (stored && stored !== panNumber) throw new ExternalApiError(400, "PAN mismatch")
}

async function handleRequest(args: { panNumberRaw: string; transactionId?: string | null }) {
  const panNumber = normalizePan(args.panNumberRaw)
  if (!panNumber) return NextResponse.json({ ok: false, error: "Invalid PAN number" }, { status: 400 })

  const user = await getCurrentUser().catch(() => null)
  if (!user) {
    const txnId = (args.transactionId || "").trim()
    if (!txnId) return NextResponse.json({ ok: false, error: "Payment required" }, { status: 402 })
    await verifyGuestPayment(txnId, panNumber)

    const data = await fetchPanDetails(panNumber)
    return NextResponse.json({ ok: true, panNumber, walletCharged: false, data })
  }

  const balances = await dbQuery<{ wallet_balance: string | number }>(
    "SELECT wallet_balance FROM users WHERE id = ? LIMIT 1",
    [user.id],
  )
  const walletBalance = Number(balances[0]?.wallet_balance ?? 0)
  if (walletBalance < REGISTERED_PAN_DETAILS_PRICE_INR) {
    return NextResponse.json({ ok: false, error: "Insufficient wallet balance." }, { status: 402 })
  }

  const data = await fetchPanDetails(panNumber)

  const charged = await chargeWalletForDownload({
    userId: user.id,
    registrationNumber: panNumber,
    price: REGISTERED_PAN_DETAILS_PRICE_INR,
    description: `PAN Details - ${panNumber}`,
  })

  return NextResponse.json({
    ok: true,
    panNumber,
    walletCharged: true,
    transactionId: charged.transactionId,
    walletBalance: charged.walletBalance,
    data,
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const panNumber = url.searchParams.get("panNumber") || ""
  const transactionId = url.searchParams.get("transactionId")

  try {
    return await handleRequest({ panNumberRaw: panNumber, transactionId })
  } catch (error: any) {
    if (error instanceof WalletError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
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
    return await handleRequest({ panNumberRaw: parsed.data.panNumber, transactionId: parsed.data.transactionId })
  } catch (error: any) {
    if (error instanceof WalletError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    if (error instanceof ExternalApiError) {
      const status =
        error.status === 404 ? 404 : error.status === 503 ? 503 : error.status === 401 || error.status === 403 ? 502 : 502
      return NextResponse.json({ ok: false, error: error.message }, { status })
    }
    return NextResponse.json({ ok: false, error: error?.message || "Lookup failed" }, { status: 500 })
  }
}

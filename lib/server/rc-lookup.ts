import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"
import { mockRCData } from "@/lib/server/rc-mock"
import { normalizeSurepassRcResponse } from "@/lib/server/rc-normalize"

export class ExternalApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/\s/g, "")
}

async function getCached(registrationNumber: string) {
  const rows = await dbQuery<{ rc_json: any }>(
    "SELECT rc_json FROM rc_documents WHERE registration_number = ? ORDER BY created_at DESC LIMIT 1",
    [registrationNumber],
  )
  const value = rows[0]?.rc_json ?? null
  if (!value) return null
  if (Buffer.isBuffer(value)) {
    try {
      return JSON.parse(value.toString("utf8"))
    } catch {
      return null
    }
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

export async function storeRcResult(
  registrationNumberRaw: string,
  userId: string | null,
  rcJson: any,
  provider: string,
  providerRef?: string | null,
) {
  const registrationNumber = normalizeRegistration(registrationNumberRaw)
  const id = crypto.randomUUID()
  const jsonValue = typeof rcJson === "string" ? rcJson : JSON.stringify(rcJson)
  await dbQuery(
    "INSERT INTO rc_documents (id, user_id, registration_number, rc_json, provider, provider_ref) VALUES (?, ?, ?, ?, ?, ?)",
    [id, userId, registrationNumber, jsonValue, provider, providerRef ?? null],
  )
}

async function fetchFromExternal(registrationNumber: string) {
  const url = process.env.RC_API_BASE_URL
  if (!url) return null

  const headers: Record<string, string> = { "content-type": "application/json" }
  if (process.env.RC_API_KEY) headers.authorization = `Bearer ${process.env.RC_API_KEY}`
  headers.accept = "application/json"

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ id_number: registrationNumber }) })
  const contentType = res.headers.get("content-type") || ""
  const body = contentType.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => "")

  if (!res.ok) {
    const message =
      typeof body === "object" && body
        ? `${body.message_code || body.code || "error"}: ${body.message || body.error || res.statusText}`
        : String(body || res.statusText)

    throw new ExternalApiError(res.status, `Surepass ${res.status} ${message}`.trim())
  }

  const json = body
  const normalized = normalizeSurepassRcResponse(registrationNumber, json)
  return normalized ?? json
}

export async function lookupRc(registrationNumberRaw: string) {
  const registrationNumber = normalizeRegistration(registrationNumberRaw)

  const cached = await getCached(registrationNumber)
  if (cached) return { registrationNumber, data: cached, provider: "cache" as const }

  const mode = (process.env.RC_API_MODE || "").toLowerCase()
  const hasExternal = Boolean(process.env.RC_API_BASE_URL)

  if (mode === "mock" || !hasExternal) {
    const data = mockRCData[registrationNumber]
    if (data) return { registrationNumber, data, provider: "mock" as const }
    if (!hasExternal) return null
  }

  const data = await fetchFromExternal(registrationNumber)
  return { registrationNumber, data, provider: "external" as const }
}


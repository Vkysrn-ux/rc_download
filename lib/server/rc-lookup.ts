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

type RcProvider = {
  index: number
  baseUrl: string
  apiKey?: string
  authHeaderName: string
  authScheme: string
  payloadField: string
  responseType: "surepass" | "raw"
}

function readIndexedEnv(baseName: string, index: number) {
  if (index === 1) return process.env[baseName] ?? process.env[`${baseName}_1`]
  return process.env[`${baseName}_${index}`]
}

function getRcProvidersFromEnv(maxProviders = 3): RcProvider[] {
  const providers: RcProvider[] = []

  for (let index = 1; index <= maxProviders; index++) {
    const baseUrl = readIndexedEnv("RC_API_BASE_URL", index)
    if (!baseUrl) continue

    const apiKey = readIndexedEnv("RC_API_KEY", index)
    const authHeaderName = (readIndexedEnv("RC_API_AUTH_HEADER_NAME", index) || "authorization").trim() || "authorization"
    const authScheme = (readIndexedEnv("RC_API_AUTH_SCHEME", index) || "Bearer").trim() || "Bearer"
    const payloadField = (readIndexedEnv("RC_API_PAYLOAD_FIELD", index) || "id_number").trim() || "id_number"
    const responseTypeRaw = (readIndexedEnv("RC_API_RESPONSE_TYPE", index) || "surepass").trim().toLowerCase()
    const responseType = responseTypeRaw === "raw" ? "raw" : "surepass"

    providers.push({ index, baseUrl, apiKey, authHeaderName, authScheme, payloadField, responseType })
  }

  return providers
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

async function fetchFromProvider(provider: RcProvider, registrationNumber: string) {
  const url = provider.baseUrl

  const headers: Record<string, string> = { "content-type": "application/json" }
  if (provider.apiKey) headers[provider.authHeaderName] = `${provider.authScheme} ${provider.apiKey}`.trim()
  headers.accept = "application/json"

  const timeoutMs = Math.max(1000, Number(process.env.RC_API_TIMEOUT_MS || 15000))
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  let body: any = null

  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ [provider.payloadField]: registrationNumber }),
      signal: controller.signal,
    })

    const contentType = res.headers.get("content-type") || ""
    body = contentType.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => "")
  } catch (error: any) {
    const message = error?.name === "AbortError" ? `timeout after ${timeoutMs}ms` : error?.message || "request failed"
    throw new ExternalApiError(502, `RC provider #${provider.index} failed: ${message}`)
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const message =
      typeof body === "object" && body
        ? `${body.message_code || body.code || "error"}: ${body.message || body.error || res.statusText}`
        : String(body || res.statusText)

    throw new ExternalApiError(res.status, `RC provider #${provider.index} ${res.status} ${message}`.trim())
  }

  const json = body
  if (provider.responseType === "raw") return json
  const normalized = normalizeSurepassRcResponse(registrationNumber, json)
  return normalized ?? json
}

export async function lookupRc(registrationNumberRaw: string) {
  const registrationNumber = normalizeRegistration(registrationNumberRaw)

  const cached = await getCached(registrationNumber)
  if (cached) return { registrationNumber, data: cached, provider: "cache" as const, providerRef: null }

  const mode = (process.env.RC_API_MODE || "").toLowerCase()
  const providers = getRcProvidersFromEnv(3)
  const hasExternal = providers.length > 0

  if (mode === "mock" || !hasExternal) {
    const data = mockRCData[registrationNumber]
    if (data) return { registrationNumber, data, provider: "mock" as const, providerRef: null }
    if (!hasExternal) return null
  }

  const errors: ExternalApiError[] = []
  for (const provider of providers) {
    try {
      const data = await fetchFromProvider(provider, registrationNumber)
      return { registrationNumber, data, provider: "external" as const, providerRef: String(provider.index) }
    } catch (error: any) {
      if (error instanceof ExternalApiError) errors.push(error)
      else errors.push(new ExternalApiError(502, `RC provider #${provider.index} failed: ${error?.message || "error"}`))
    }
  }

  if (errors.length && errors.every((e) => e.status === 404)) return null

  const summary = errors.map((e) => `[${e.status}] ${e.message}`).join(" | ")
  throw new ExternalApiError(502, summary || "All RC providers failed")
}

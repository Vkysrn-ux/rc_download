import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"
import { mockRCData } from "@/lib/server/rc-mock"
import { normalizeSurepassRcResponse, type NormalizedRCData } from "@/lib/server/rc-normalize"

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

function isNormalizedRcData(value: any): value is NormalizedRCData {
  if (!value || typeof value !== "object") return false
  return (
    typeof value.registrationNumber === "string" &&
    typeof value.ownerName === "string" &&
    typeof value.vehicleClass === "string" &&
    typeof value.maker === "string" &&
    typeof value.model === "string" &&
    typeof value.fuelType === "string" &&
    typeof value.registrationDate === "string" &&
    typeof value.chassisNumber === "string" &&
    typeof value.engineNumber === "string" &&
    typeof value.address === "string"
  )
}

function hasMissingCriticalFields(value: NormalizedRCData) {
  return !value.maker.trim() || !value.fuelType.trim()
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
    const authSchemeRaw = readIndexedEnv("RC_API_AUTH_SCHEME", index)
    const authScheme = authSchemeRaw === undefined ? "Bearer" : authSchemeRaw.trim()
    const payloadField = (readIndexedEnv("RC_API_PAYLOAD_FIELD", index) || "id_number").trim() || "id_number"
    const responseTypeRaw = (readIndexedEnv("RC_API_RESPONSE_TYPE", index) || "surepass").trim().toLowerCase()
    const responseType = responseTypeRaw === "raw" ? "raw" : "surepass"

    providers.push({ index, baseUrl, apiKey, authHeaderName, authScheme, payloadField, responseType })
  }

  return providers
}

function getApnircB2bFallbackProviderFromEnv(): RcProvider | null {
  const apiKey = (process.env.RC_API_APNIRC_B2B_AUTHORIZATION || "").trim()
  if (!apiKey) return null

  const baseUrl = (process.env.RC_API_APNIRC_B2B_URL || "https://api.apnirc.xyz/api/b2b/get-rc").trim()
  if (!baseUrl) return null

  const responseTypeRaw = (process.env.RC_API_APNIRC_B2B_RESPONSE_TYPE || "surepass").trim().toLowerCase()
  const responseType = responseTypeRaw === "raw" ? "raw" : "surepass"

  return {
    index: 4,
    baseUrl,
    apiKey,
    authHeaderName: "Authorization",
    authScheme: "",
    payloadField: "vrn",
    responseType,
  }
}

async function getCached(registrationNumber: string) {
  const rows = await dbQuery<{
    rc_json: any
    provider: string
    provider_ref: string | null
    latest_external_provider_ref: string | null
  }>(
    `SELECT d.rc_json,
            d.provider,
            d.provider_ref,
            (
              SELECT d2.provider_ref
              FROM rc_documents d2
              WHERE d2.registration_number = d.registration_number
                AND d2.provider = 'external'
              ORDER BY d2.created_at DESC
              LIMIT 1
            ) AS latest_external_provider_ref
     FROM rc_documents d
     WHERE d.registration_number = ?
     ORDER BY d.created_at DESC
     LIMIT 1`,
    [registrationNumber],
  )

  const row = rows[0]
  const value = row?.rc_json ?? null
  if (!value) return null

  let parsed: any = null
  if (Buffer.isBuffer(value)) {
    try {
      parsed = JSON.parse(value.toString("utf8"))
    } catch {
      parsed = null
    }
  } else if (typeof value === "string") {
    try {
      parsed = JSON.parse(value)
    } catch {
      parsed = null
    }
  } else {
    parsed = value
  }

  if (!parsed) return null

  let sourceProviderRef: string | null = null
  if ((row?.provider === "external" || row?.provider === "cache") && row?.provider_ref) {
    sourceProviderRef = String(row.provider_ref)
  } else if (row?.latest_external_provider_ref) {
    sourceProviderRef = String(row.latest_external_provider_ref)
  }

  return { rcJson: parsed, sourceProviderRef }
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
  if (provider.apiKey) {
    const value = provider.authScheme ? `${provider.authScheme} ${provider.apiKey}` : provider.apiKey
    headers[provider.authHeaderName] = value.trim()
  }
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

  return body
}

export async function lookupRc(registrationNumberRaw: string) {
  const registrationNumber = normalizeRegistration(registrationNumberRaw)

  const cachedResult = await getCached(registrationNumber)
  const cached = cachedResult?.rcJson ?? null
  const cachedProviderRef = cachedResult?.sourceProviderRef ?? null
  if (cached) {
    if (isNormalizedRcData(cached) && !hasMissingCriticalFields(cached)) {
      return { registrationNumber, data: cached, provider: "cache" as const, providerRef: cachedProviderRef }
    }
    const normalizedCached = normalizeSurepassRcResponse(registrationNumber, cached)
    if (normalizedCached && !hasMissingCriticalFields(normalizedCached)) {
      return { registrationNumber, data: normalizedCached, provider: "cache" as const, providerRef: cachedProviderRef }
    }
  }

  const mode = (process.env.RC_API_MODE || "").toLowerCase()
  const providers = getRcProvidersFromEnv(3)
  const apnircB2bFallback = getApnircB2bFallbackProviderFromEnv()
  const hasExternal = providers.length > 0 || Boolean(apnircB2bFallback)

  if (mode === "mock" || !hasExternal) {
    const data = mockRCData[registrationNumber]
    if (data) return { registrationNumber, data, provider: "mock" as const, providerRef: null }
    if (!hasExternal) return null
  }

  const errors: ExternalApiError[] = []
  for (const provider of providers) {
    try {
      const raw = await fetchFromProvider(provider, registrationNumber)
      const normalized = isNormalizedRcData(raw) ? raw : normalizeSurepassRcResponse(registrationNumber, raw)

      if (!normalized) {
        if (provider.responseType === "raw") throw new ExternalApiError(502, `RC provider #${provider.index} returned unsupported response format`)

        let detail = ""
        if (raw && typeof raw === "object") {
          const rootKeys = Object.keys(raw).slice(0, 12).join(", ")
          const dataValue: any = (raw as any).data ?? (raw as any).result ?? (raw as any).response ?? (raw as any).output ?? null
          const dataKeys =
            dataValue && typeof dataValue === "object" && !Array.isArray(dataValue)
              ? Object.keys(dataValue).slice(0, 12).join(", ")
              : ""
          detail = ` (keys: ${rootKeys || "none"}${dataKeys ? `; data keys: ${dataKeys}` : ""})`
        } else if (typeof raw === "string" && raw.trim()) {
          detail = ` (non-JSON response)`
        }

        throw new ExternalApiError(502, `RC provider #${provider.index} returned unsupported response format${detail}`)
      }

      return { registrationNumber, data: normalized, provider: "external" as const, providerRef: String(provider.index) }
    } catch (error: any) {
      if (error instanceof ExternalApiError) errors.push(error)
      else errors.push(new ExternalApiError(502, `RC provider #${provider.index} failed: ${error?.message || "error"}`))
    }
  }

  if (apnircB2bFallback) {
    try {
      const raw = await fetchFromProvider(apnircB2bFallback, registrationNumber)
      const normalized = isNormalizedRcData(raw) ? raw : normalizeSurepassRcResponse(registrationNumber, raw)

      if (!normalized) {
        let detail = ""
        if (raw && typeof raw === "object") {
          const rootKeys = Object.keys(raw).slice(0, 12).join(", ")
          const dataValue: any = (raw as any).data ?? (raw as any).result ?? (raw as any).response ?? (raw as any).output ?? null
          const dataKeys =
            dataValue && typeof dataValue === "object" && !Array.isArray(dataValue)
              ? Object.keys(dataValue).slice(0, 12).join(", ")
              : ""
          detail = ` (keys: ${rootKeys || "none"}${dataKeys ? `; data keys: ${dataKeys}` : ""})`
        } else if (typeof raw === "string" && raw.trim()) {
          detail = ` (non-JSON response)`
        }

        throw new ExternalApiError(502, `RC provider #${apnircB2bFallback.index} returned unsupported response format${detail}`)
      }

      return { registrationNumber, data: normalized, provider: "external" as const, providerRef: "apnirc-b2b" }
    } catch (error: any) {
      if (error instanceof ExternalApiError) errors.push(error)
      else errors.push(new ExternalApiError(502, `RC provider #${apnircB2bFallback.index} failed: ${error?.message || "error"}`))
    }
  }

  if (errors.length && errors.every((e) => e.status === 404)) return null

  const summary = errors.map((e) => `[${e.status}] ${e.message}`).join(" | ")
  throw new ExternalApiError(502, summary || "All RC providers failed")
}

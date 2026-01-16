import crypto from "crypto"
import { readFileSync } from "fs"
import { dbQuery } from "@/lib/server/db"
import { mockRCData } from "@/lib/server/rc-mock"
import { normalizeSurepassRcResponse, type NormalizedRCData, unmaskNormalizedRcData } from "@/lib/server/rc-normalize"

export class ExternalApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type RcLookupProgressEvent =
  | { type: "cache_hit" }
  | { type: "mock_hit" }
  | { type: "provider_attempt"; providerIndex: number }
  | { type: "provider_failed"; providerIndex: number; status: number; message: string }
  | { type: "provider_succeeded"; providerIndex: number }

export function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/\s/g, "")
}

function generateNumericReferenceId() {
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0")
  return `${Date.now()}${random}`
}

type RcProvider = {
  index: number
  baseUrl: string
  method: "GET" | "POST"
  apiKey?: string
  authHeaderName: string
  authScheme: string
  payloadField: string
  extraHeaders?: Record<string, string> | null
  extraParams?: Record<string, string> | null
  signaturePublicKeyPath?: string | null
  signaturePublicKeyPem?: string | null
  signatureHeaderName?: string | null
  signatureTimestampHeaderName?: string | null
  responseType: "surepass" | "raw"
}

function normalizeStatusValue(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.toUpperCase() : null
}

function looksLikeRcPayload(value: any) {
  if (!value || typeof value !== "object") return false
  const keys = new Set(Object.keys(value))
  return (
    keys.has("reg_no") ||
    keys.has("vehicle_number") ||
    keys.has("owner") ||
    keys.has("owner_name") ||
    keys.has("chassis") ||
    keys.has("engine") ||
    keys.has("registration_date") ||
    keys.has("reg_date") ||
    keys.has("registration_number") ||
    keys.has("vehicle_manufacturer_name") ||
    keys.has("model")
  )
}

function extractProviderError(raw: any) {
  if (!raw || typeof raw !== "object") return null
  const root = raw as Record<string, any>
  const candidates = [root, root.data, root.result, root.response, root.output].filter((item) => item && typeof item === "object")

  const statusValue = normalizeStatusValue(root.status)
  if (statusValue && statusValue !== "VALID") {
    return { status: statusValue === "INVALID" ? 404 : 502, message: `status ${statusValue}` }
  }

  if (candidates.some(looksLikeRcPayload)) return null

  const messageCandidates = [root, ...candidates]
  for (const candidate of messageCandidates) {
    const message = typeof candidate.message === "string" ? candidate.message.trim() : ""
    const code = typeof candidate.code === "string" ? candidate.code.trim() : ""
    const type = typeof candidate.type === "string" ? candidate.type.trim() : ""
    if (message && (code || type)) {
      return { status: 502, message: `${code || type}: ${message}` }
    }
  }

  return null
}

function classifyRcVariantFromUrl(baseUrl: string | null) {
  const value = (baseUrl || "").toLowerCase()
  if (!value) return "unknown"
  if (value.includes("cashfree") || value.includes("vehicle-rc") || value.includes("vrs")) return "cashfree-vrs"
  if (value.includes("apnirc")) return "apnirc"
  if (value.includes("rc-full")) return "rc-full"
  if (value.includes("rc-v2")) return "rc-v2"
  if (value.includes("rc-lite")) return "rc-lite"
  return "unknown"
}

const APNIRC_FALLBACK_INDEX = 5

function providerRefForCall(provider: RcProvider) {
  if (provider.index === APNIRC_FALLBACK_INDEX) return "apnirc-b2b"
  return String(provider.index)
}

async function logRcApiCall(args: {
  userId: string | null
  registrationNumber: string
  providerRef: string | null
  baseUrl: string | null
  outcome: "success" | "failure"
  httpStatus: number | null
  errorMessage: string | null
}) {
  try {
    const id = crypto.randomUUID()
    const variant = classifyRcVariantFromUrl(args.baseUrl)
    await dbQuery(
      "INSERT INTO rc_api_calls (id, user_id, registration_number, provider_ref, base_url, variant, outcome, http_status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        args.userId,
        args.registrationNumber,
        args.providerRef,
        args.baseUrl,
        variant,
        args.outcome,
        args.httpStatus,
        args.errorMessage ? String(args.errorMessage).slice(0, 255) : null,
      ],
    )
  } catch {
    // Best-effort; ignore missing table or other DB errors.
  }
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

function looksMasked(value: string) {
  const text = (value || "").trim()
  if (!text) return false
  if (text.includes("*")) return true
  if (text.includes("•")) return true
  if (text.includes("ƒ?›")) return true
  if (/[xX]{3,}/.test(text)) return true
  return false
}

function isOwnerNameMasked(value: NormalizedRCData) {
  return looksMasked(value.ownerName)
}

function readIndexedEnv(baseName: string, index: number) {
  if (index === 1) return process.env[baseName] ?? process.env[`${baseName}_1`]
  return process.env[`${baseName}_${index}`]
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
    console.error(`[rc-lookup] Failed to read public key at ${path}: ${(error as Error)?.message || "unknown error"}`)
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
    console.error(`[rc-lookup] Cashfree VRS signature generation failed: ${(error as Error)?.message || "unknown error"}`)
    return null
  }
}

function parseJsonRecord(value: string | undefined, label: string): Record<string, string> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn(`[rc-lookup] ${label} must be a JSON object`)
      return null
    }
    const record: Record<string, string> = {}
    for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (entry === null || entry === undefined) continue
      if (typeof entry === "string") {
        record[key] = entry
      } else if (typeof entry === "number" || typeof entry === "boolean") {
        record[key] = String(entry)
      }
    }
    return Object.keys(record).length ? record : null
  } catch (error) {
    console.warn(`[rc-lookup] Invalid ${label}: ${(error as Error)?.message || "unable to parse JSON"}`)
    return null
  }
}

function normalizeHttpMethod(value: string | undefined): "GET" | "POST" {
  const method = (value || "").trim().toUpperCase()
  return method === "GET" ? "GET" : "POST"
}

function normalizeBaseUrlForCompare(value: string | null | undefined) {
  return (value || "").trim().replace(/\/+$/, "")
}

function shouldSendEnrichFlag(provider: RcProvider) {
  const configured = normalizeBaseUrlForCompare(readIndexedEnv("RC_API_BASE_URL", 2))
  if (!configured) return false
  return normalizeBaseUrlForCompare(provider.baseUrl) === configured
}

function getRcProvidersFromEnv(maxProviders = 4): RcProvider[] {
  const providers: RcProvider[] = []

  for (let index = 1; index <= maxProviders; index++) {
    const baseUrl = readIndexedEnv("RC_API_BASE_URL", index)
    if (!baseUrl) continue

    const suffix = index === 1 ? "" : `_${index}`
    const apiKey = readIndexedEnv("RC_API_KEY", index)
    const authHeaderName = (readIndexedEnv("RC_API_AUTH_HEADER_NAME", index) || "authorization").trim() || "authorization"
    const authSchemeRaw = readIndexedEnv("RC_API_AUTH_SCHEME", index)
    const authScheme = authSchemeRaw === undefined ? "Bearer" : authSchemeRaw.trim()
    const payloadField = (readIndexedEnv("RC_API_PAYLOAD_FIELD", index) || "id_number").trim() || "id_number"
    const method = normalizeHttpMethod(readIndexedEnv("RC_API_METHOD", index))
    const extraHeaders = parseJsonRecord(readIndexedEnv("RC_API_HEADERS", index), `RC_API_HEADERS${suffix}`)
    const extraParams = parseJsonRecord(readIndexedEnv("RC_API_EXTRA_PARAMS", index), `RC_API_EXTRA_PARAMS${suffix}`)
    const signaturePublicKeyPathRaw = (readIndexedEnv("RC_API_SIGNATURE_PUBLIC_KEY_PATH", index) || "").trim()
    const signaturePublicKeyInlineRaw = (readIndexedEnv("RC_API_SIGNATURE_PUBLIC_KEY", index) || "").trim()
    let signaturePublicKeyPem = signaturePublicKeyInlineRaw || null
    let signaturePublicKeyPath = signaturePublicKeyPathRaw || null
    if (signaturePublicKeyPath && signaturePublicKeyPath.includes("BEGIN PUBLIC KEY")) {
      signaturePublicKeyPem = signaturePublicKeyPem || signaturePublicKeyPath
      signaturePublicKeyPath = null
    }
    const signatureHeaderName = (readIndexedEnv("RC_API_SIGNATURE_HEADER_NAME", index) || "").trim() || null
    const signatureTimestampHeaderName = (readIndexedEnv("RC_API_SIGNATURE_TIMESTAMP_HEADER_NAME", index) || "").trim() || null
    const responseTypeRaw = (readIndexedEnv("RC_API_RESPONSE_TYPE", index) || "surepass").trim().toLowerCase()
    const responseType = responseTypeRaw === "raw" ? "raw" : "surepass"

    if ((signaturePublicKeyPath || signaturePublicKeyPem) && !signatureHeaderName) {
      console.warn(`[rc-lookup] RC_API_SIGNATURE_HEADER_NAME${suffix} is required when RC_API_SIGNATURE_PUBLIC_KEY_PATH${suffix} is set`)
    }

    providers.push({
      index,
      baseUrl,
      method,
      apiKey,
      authHeaderName,
      authScheme,
      payloadField,
      extraHeaders,
      extraParams,
      signaturePublicKeyPath,
      signaturePublicKeyPem,
      signatureHeaderName,
      signatureTimestampHeaderName,
      responseType,
    })
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
    index: APNIRC_FALLBACK_INDEX,
    baseUrl,
    method: "POST",
    apiKey,
    authHeaderName: "Authorization",
    authScheme: "",
    payloadField: "vrn",
    extraHeaders: null,
    extraParams: null,
    signaturePublicKeyPath: null,
    signatureHeaderName: null,
    signatureTimestampHeaderName: null,
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
  let url = provider.baseUrl
  const headers: Record<string, string> = { accept: "application/json" }
  if (provider.method !== "GET") {
    headers["content-type"] = "application/json"
  }
  if (provider.apiKey) {
    const value = provider.authScheme ? `${provider.authScheme} ${provider.apiKey}` : provider.apiKey
    headers[provider.authHeaderName] = value.trim()
  }
  if (provider.extraHeaders) {
    for (const [key, value] of Object.entries(provider.extraHeaders)) {
      headers[key] = value
    }
  }
  if (provider.signaturePublicKeyPath || provider.signaturePublicKeyPem) {
    if (!provider.apiKey) {
      console.warn(`[rc-lookup] Missing RC_API_KEY for provider #${provider.index}; cannot generate signature`)
    } else if (!provider.signatureHeaderName) {
      console.warn(`[rc-lookup] Missing RC_API_SIGNATURE_HEADER_NAME for provider #${provider.index}; cannot attach signature`)
    } else {
      const generated = generateCashfreeVrsSignature(provider.apiKey, provider.signaturePublicKeyPath, provider.signaturePublicKeyPem)
      if (generated) {
        headers[provider.signatureHeaderName] = generated.signature
        if (provider.signatureTimestampHeaderName) {
          headers[provider.signatureTimestampHeaderName] = String(generated.timestamp)
        }
      }
    }
  }

  const timeoutMs = Math.max(1000, Number(process.env.RC_API_TIMEOUT_MS || 15000))
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  let body: any = null

  try {
    const payload: Record<string, unknown> = { ...(provider.extraParams ?? {}), [provider.payloadField]: registrationNumber }
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
    if (shouldSendEnrichFlag(provider)) payload.enrich = true

    let requestBody: string | undefined
    if (provider.method === "GET") {
      const urlObj = new URL(url)
      for (const [key, value] of Object.entries(payload)) {
        if (value === undefined || value === null) continue
        urlObj.searchParams.set(key, String(value))
      }
      url = urlObj.toString()
    } else {
      requestBody = JSON.stringify(payload)
    }

    res = await fetch(url, {
      method: provider.method,
      headers,
      body: requestBody,
      signal: controller.signal,
      cache: "no-store",
    })

    const contentType = res.headers.get("content-type") || ""
    body = contentType.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => "")
    if (typeof body === "string") {
      const trimmed = body.trim()
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          body = JSON.parse(trimmed)
        } catch {
          // Keep original text if it is not valid JSON.
        }
      }
    }
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

export async function lookupRc(
  registrationNumberRaw: string,
  options?: {
    onProgress?: (event: RcLookupProgressEvent) => void
    userId?: string | null
    bypassCache?: boolean
  },
) {
  const registrationNumber = normalizeRegistration(registrationNumberRaw)
  const emit = options?.onProgress
    ? (event: RcLookupProgressEvent) => {
        try {
          options.onProgress?.(event)
        } catch {
          // ignore observer errors
        }
      }
    : null

  const mode = (process.env.RC_API_MODE || "").toLowerCase()
  // Providers 1..4 are read from RC_API_BASE_URL[_2.._4] in order.
  // APNIRC B2B is an optional final fallback when configured.
  const providers = getRcProvidersFromEnv(4)
  const apnircB2bFallback = getApnircB2bFallbackProviderFromEnv()
  const hasExternal = providers.length > 0 || Boolean(apnircB2bFallback)

  const shouldUseCache = !options?.bypassCache
  if (shouldUseCache) {
    const cachedResult = await getCached(registrationNumber)
    const cached = cachedResult?.rcJson ?? null
    const cachedProviderRef = cachedResult?.sourceProviderRef ?? null
    if (cached) {
      if (isNormalizedRcData(cached) && !hasMissingCriticalFields(cached)) {
        if (!hasExternal || !isOwnerNameMasked(cached)) {
          emit?.({ type: "cache_hit" })
          return {
            registrationNumber,
            data: unmaskNormalizedRcData(registrationNumber, cached),
            provider: "cache" as const,
            providerRef: cachedProviderRef,
          }
        }
      }
      const normalizedCached = normalizeSurepassRcResponse(registrationNumber, cached)
      if (normalizedCached && !hasMissingCriticalFields(normalizedCached)) {
        if (!hasExternal || !isOwnerNameMasked(normalizedCached)) {
          emit?.({ type: "cache_hit" })
          return {
            registrationNumber,
            data: unmaskNormalizedRcData(registrationNumber, normalizedCached),
            provider: "cache" as const,
            providerRef: cachedProviderRef,
          }
        }
      }
    }
  }

  if (mode === "mock" || !hasExternal) {
    const data = mockRCData[registrationNumber]
    if (data) {
      emit?.({ type: "mock_hit" })
      return { registrationNumber, data: unmaskNormalizedRcData(registrationNumber, data), provider: "mock" as const, providerRef: null }
    }
    if (!hasExternal) return null
  }

  const errors: ExternalApiError[] = []
  let sawMaskedOwnerName = false
  for (const provider of providers) {
    try {
      emit?.({ type: "provider_attempt", providerIndex: provider.index })
      const raw = await fetchFromProvider(provider, registrationNumber)
      const providerError = extractProviderError(raw)
      if (providerError) {
        throw new ExternalApiError(providerError.status, `RC provider #${provider.index} ${providerError.message}`.trim())
      }
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

      if (isOwnerNameMasked(normalized)) {
        sawMaskedOwnerName = true
        emit?.({ type: "provider_failed", providerIndex: provider.index, status: 200, message: "Owner name masked; trying next server" })
        void logRcApiCall({
          userId: options?.userId ?? null,
          registrationNumber,
          providerRef: providerRefForCall(provider),
          baseUrl: provider.baseUrl,
          outcome: "failure",
          httpStatus: 200,
          errorMessage: "Owner name masked",
        })
        continue
      }

      const unmasked = unmaskNormalizedRcData(registrationNumber, normalized)
      emit?.({ type: "provider_succeeded", providerIndex: provider.index })
      void logRcApiCall({
        userId: options?.userId ?? null,
        registrationNumber,
        providerRef: providerRefForCall(provider),
        baseUrl: provider.baseUrl,
        outcome: "success",
        httpStatus: 200,
        errorMessage: null,
      })
      return { registrationNumber, data: unmasked, provider: "external" as const, providerRef: providerRefForCall(provider) }
    } catch (error: any) {
      if (error instanceof ExternalApiError) {
        errors.push(error)
        emit?.({ type: "provider_failed", providerIndex: provider.index, status: error.status, message: error.message })
        void logRcApiCall({
          userId: options?.userId ?? null,
          registrationNumber,
          providerRef: providerRefForCall(provider),
          baseUrl: provider.baseUrl,
          outcome: "failure",
          httpStatus: Number.isFinite(error.status) ? Number(error.status) : 502,
          errorMessage: error.message,
        })
      } else {
        const message = error?.message || "error"
        errors.push(new ExternalApiError(502, `RC provider #${provider.index} failed: ${message}`))
        emit?.({ type: "provider_failed", providerIndex: provider.index, status: 502, message })
        void logRcApiCall({
          userId: options?.userId ?? null,
          registrationNumber,
          providerRef: providerRefForCall(provider),
          baseUrl: provider.baseUrl,
          outcome: "failure",
          httpStatus: 502,
          errorMessage: message,
        })
      }
    }
  }

  if (apnircB2bFallback) {
    try {
      emit?.({ type: "provider_attempt", providerIndex: apnircB2bFallback.index })
      const raw = await fetchFromProvider(apnircB2bFallback, registrationNumber)
      const providerError = extractProviderError(raw)
      if (providerError) {
        throw new ExternalApiError(providerError.status, `RC provider #${apnircB2bFallback.index} ${providerError.message}`.trim())
      }
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

      if (isOwnerNameMasked(normalized)) {
        sawMaskedOwnerName = true
        emit?.({ type: "provider_failed", providerIndex: apnircB2bFallback.index, status: 200, message: "Owner name masked; no more servers" })
        void logRcApiCall({
          userId: options?.userId ?? null,
          registrationNumber,
          providerRef: providerRefForCall(apnircB2bFallback),
          baseUrl: apnircB2bFallback.baseUrl,
          outcome: "failure",
          httpStatus: 200,
          errorMessage: "Owner name masked",
        })
        errors.push(new ExternalApiError(200, "Owner name masked"))
      } else {
        const unmasked = unmaskNormalizedRcData(registrationNumber, normalized)
        emit?.({ type: "provider_succeeded", providerIndex: apnircB2bFallback.index })
        void logRcApiCall({
          userId: options?.userId ?? null,
          registrationNumber,
          providerRef: providerRefForCall(apnircB2bFallback),
          baseUrl: apnircB2bFallback.baseUrl,
          outcome: "success",
          httpStatus: 200,
          errorMessage: null,
        })
        return { registrationNumber, data: unmasked, provider: "external" as const, providerRef: "apnirc-b2b" }
      }
    } catch (error: any) {
      if (error instanceof ExternalApiError) {
        errors.push(error)
        emit?.({ type: "provider_failed", providerIndex: apnircB2bFallback.index, status: error.status, message: error.message })
        void logRcApiCall({
          userId: options?.userId ?? null,
          registrationNumber,
          providerRef: providerRefForCall(apnircB2bFallback),
          baseUrl: apnircB2bFallback.baseUrl,
          outcome: "failure",
          httpStatus: Number.isFinite(error.status) ? Number(error.status) : 502,
          errorMessage: error.message,
        })
      } else {
        const message = error?.message || "error"
        errors.push(new ExternalApiError(502, `RC provider #${apnircB2bFallback.index} failed: ${message}`))
        emit?.({ type: "provider_failed", providerIndex: apnircB2bFallback.index, status: 502, message })
        void logRcApiCall({
          userId: options?.userId ?? null,
          registrationNumber,
          providerRef: providerRefForCall(apnircB2bFallback),
          baseUrl: apnircB2bFallback.baseUrl,
          outcome: "failure",
          httpStatus: 502,
          errorMessage: message,
        })
      }
    }
  }

  if (errors.length && errors.every((e) => e.status === 404) && !sawMaskedOwnerName) return null

  const summary = errors.map((e) => `[${e.status}] ${e.message}`).join(" | ")

  // If we couldn't get a usable RC response, do not allow the flow to continue to payment/wallet deduction.
  if (hasExternal) throw new ExternalApiError(503, summary || "Server down now")

  throw new ExternalApiError(502, summary || "All RC providers failed")
}

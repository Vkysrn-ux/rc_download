import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"

function readIndexedEnv(baseName: string, index: number) {
  if (index === 1) return process.env[baseName] ?? process.env[`${baseName}_1`]
  return process.env[`${baseName}_${index}`]
}

function classifyRcVariant(baseUrl: string | null) {
  const value = (baseUrl || "").toLowerCase()
  if (!value) return "unknown"
  if (value.includes("cashfree") || value.includes("vehicle-rc") || value.includes("vrs")) return "cashfree-vrs"
  if (value.includes("apnirc")) return "apnirc"
  if (value.includes("rc-full")) return "rc-full"
  if (value.includes("rc-v2")) return "rc-v2"
  if (value.includes("rc-lite")) return "rc-lite"
  return "unknown"
}

function resolveProviderBaseUrl(providerRef: string | null) {
  if (!providerRef) return null
  if (providerRef === "apnirc-b2b") return (process.env.RC_API_APNIRC_B2B_URL || "https://api.apnirc.xyz/api/b2b/get-rc").trim() || null
  const index = Number(providerRef)
  if (!Number.isFinite(index) || index <= 0) return null
  return readIndexedEnv("RC_API_BASE_URL", index) ?? null
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const includeParam = new URL(req.url).searchParams.get("include")
  const includeAll = !includeParam
  const include = new Set(
    (includeParam || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  )
  const wants = (key: string) => includeAll || include.has(key)

  const wantApiCalls = wants("apiCalls")
  const wantCounts = wants("counts")
  const wantExternalByVariant = wants("externalByVariant")
  const wantExternalByProvider = wants("externalByProvider")
  const wantCacheByVariant = wants("cacheByVariant")
  const wantCacheByProvider = wants("cacheByProvider")
  const wantByProvider = wants("byProvider")
  const wantByVehicle = wants("byVehicle")
  const wantByUser = wants("byUser")
  const wantRecent = wants("recent")

  let apiCallsByVariant: { variant: string; hits: number; successes: number; failures: number }[] = []
  if (wantApiCalls) {
    try {
      const rows = await dbQuery<{
        variant: string
        hits: string | number
        successes: string | number
        failures: string | number
      }>(
        `SELECT variant,
                COUNT(*) AS hits,
                SUM(outcome = 'success') AS successes,
                SUM(outcome = 'failure') AS failures
         FROM rc_api_calls
         GROUP BY variant`,
      )
      apiCallsByVariant = rows.map((r) => ({
        variant: String(r.variant || "unknown"),
        hits: Number(r.hits),
        successes: Number(r.successes),
        failures: Number(r.failures),
      }))
    } catch {
      apiCallsByVariant = []
    }
  }

  const apiCallOrder = ["cashfree-vrs", "rc-full", "apnirc", "rc-v2", "rc-lite"]
  const apiCallLabel: Record<string, string> = {
    "cashfree-vrs": "Cashfree VRS",
    "rc-v2": "RC-v2",
    "rc-full": "rc-full",
    "rc-lite": "rc-lite",
    apnirc: "apnirc",
  }
  const apiCalls = apiCallOrder.map((variant) => {
    const row = apiCallsByVariant.find((r) => r.variant === variant)
    return { name: apiCallLabel[variant], hits: row?.hits ?? 0, successes: row?.successes ?? 0, failures: row?.failures ?? 0 }
  })

  let totalLookups = 0
  let surepassHits = 0
  let cacheReused = 0
  if (wantCounts) {
    const [{ totalLookups: totalLookupsRow }] = await dbQuery<{ totalLookups: string | number }>(
      "SELECT COUNT(*) AS totalLookups FROM rc_documents WHERE provider IN ('external', 'cache')",
    )
    const [{ surepassHits: surepassHitsRow }] = await dbQuery<{ surepassHits: string | number }>(
      "SELECT COUNT(*) AS surepassHits FROM rc_documents WHERE provider = 'external'",
    )
    const [{ cacheReused: cacheReusedRow }] = await dbQuery<{ cacheReused: string | number }>(
      "SELECT COUNT(*) AS cacheReused FROM rc_documents WHERE provider = 'cache'",
    )
    totalLookups = Number(totalLookupsRow)
    surepassHits = Number(surepassHitsRow)
    cacheReused = Number(cacheReusedRow)
  }

  const needExternalProviderStats = wantExternalByProvider || wantExternalByVariant || wantByProvider
  const needCacheProviderStats = wantCacheByProvider || wantCacheByVariant || wantByProvider

  const externalByProviderRef = needExternalProviderStats
    ? await dbQuery<{ provider_ref: string | null; hits: string | number }>(
        `SELECT provider_ref, COUNT(*) AS hits
         FROM rc_documents
         WHERE provider = 'external'
         GROUP BY provider_ref
         ORDER BY hits DESC`,
      )
    : []

  const externalByProvider = externalByProviderRef.map((r) => {
    const providerRef = r.provider_ref ? String(r.provider_ref) : null
    const baseUrl = resolveProviderBaseUrl(providerRef)
    const variant = classifyRcVariant(baseUrl)
    return { providerRef, baseUrl, variant, hits: Number(r.hits) }
  })

  const cacheByProviderRef = needCacheProviderStats
    ? await dbQuery<{ provider_ref: string | null; hits: string | number }>(
        `SELECT provider_ref, COUNT(*) AS hits
         FROM rc_documents
         WHERE provider = 'cache'
         GROUP BY provider_ref
         ORDER BY hits DESC`,
      )
    : []

  const cacheByProvider = cacheByProviderRef.map((r) => {
    const providerRef = r.provider_ref ? String(r.provider_ref) : null
    const baseUrl = resolveProviderBaseUrl(providerRef)
    const variant = classifyRcVariant(baseUrl)
    return { providerRef, baseUrl, variant, hits: Number(r.hits) }
  })

  const externalByVariantMap = new Map<string, number>()
  for (const item of externalByProvider) {
    externalByVariantMap.set(item.variant, (externalByVariantMap.get(item.variant) || 0) + item.hits)
  }
  const externalByVariant = Array.from(externalByVariantMap.entries())
    .map(([variant, hits]) => ({ variant, hits }))
    .sort((a, b) => b.hits - a.hits)

  const cacheByVariantMap = new Map<string, number>()
  for (const item of cacheByProvider) {
    cacheByVariantMap.set(item.variant, (cacheByVariantMap.get(item.variant) || 0) + item.hits)
  }
  const cacheByVariant = Array.from(cacheByVariantMap.entries())
    .map(([variant, hits]) => ({ variant, hits }))
    .sort((a, b) => b.hits - a.hits)

  const byProvider = (() => {
    if (!wantByProvider) return []
    const configuredProviderRefs = new Set<string>()
    for (let index = 1; index <= 4; index++) {
      const baseUrl = readIndexedEnv("RC_API_BASE_URL", index)
      if (baseUrl) configuredProviderRefs.add(String(index))
    }
    if ((process.env.RC_API_APNIRC_B2B_AUTHORIZATION || "").trim()) configuredProviderRefs.add("apnirc-b2b")

    const byProviderMap = new Map<
      string,
      { providerRef: string | null; baseUrl: string | null; variant: string; externalHits: number; cacheHits: number; totalHits: number }
    >()

    function upsert(providerRef: string | null) {
      const key = providerRef ?? "unknown"
      const existing = byProviderMap.get(key)
      if (existing) return existing
      const baseUrl = resolveProviderBaseUrl(providerRef)
      const variant = classifyRcVariant(baseUrl)
      const created = { providerRef, baseUrl, variant, externalHits: 0, cacheHits: 0, totalHits: 0 }
      byProviderMap.set(key, created)
      return created
    }

    for (const providerRef of configuredProviderRefs) upsert(providerRef)
    for (const item of externalByProvider) upsert(item.providerRef).externalHits += item.hits
    for (const item of cacheByProvider) upsert(item.providerRef).cacheHits += item.hits
    for (const value of byProviderMap.values()) value.totalHits = value.externalHits + value.cacheHits
    return Array.from(byProviderMap.values()).sort((a, b) => b.totalHits - a.totalHits)
  })()

  const byVehicle = wantByVehicle
    ? await dbQuery<{
        registration_number: string
        surepass_hits: string | number
        cache_reused: string | number
        total: string | number
      }>(
        `SELECT registration_number,
                SUM(provider = 'external') AS surepass_hits,
                SUM(provider = 'cache') AS cache_reused,
                COUNT(*) AS total
         FROM rc_documents
         WHERE provider IN ('external', 'cache')
         GROUP BY registration_number
         ORDER BY total DESC
         LIMIT 50`,
      )
    : []

  const byUser = wantByUser
    ? await dbQuery<{
        user_key: string
        user_name: string | null
        user_email: string | null
        surepass_hits: string | number
        cache_reused: string | number
        total: string | number
      }>(
        `SELECT COALESCE(u.id, 'guest') AS user_key,
                u.name AS user_name,
                u.email AS user_email,
                SUM(d.provider = 'external') AS surepass_hits,
                SUM(d.provider = 'cache') AS cache_reused,
                COUNT(*) AS total
         FROM rc_documents d
         LEFT JOIN users u ON u.id = d.user_id
         WHERE d.provider IN ('external', 'cache')
         GROUP BY user_key, u.name, u.email
         ORDER BY total DESC
         LIMIT 50`,
      )
    : []

  const recent = wantRecent
    ? await dbQuery<{
        id: string
        registration_number: string
        provider: "external" | "cache"
        provider_ref: string | null
        created_at: string
        user_id: string | null
        user_name: string | null
        user_email: string | null
      }>(
        `SELECT d.id,
                d.registration_number,
                d.provider,
                d.provider_ref,
                d.created_at,
                u.id AS user_id,
                u.name AS user_name,
                u.email AS user_email
         FROM rc_documents d
         LEFT JOIN users u ON u.id = d.user_id
         WHERE d.provider IN ('external', 'cache')
         ORDER BY d.created_at DESC
         LIMIT 100`,
      )
    : []

  return NextResponse.json({
    ok: true,
    ...(wantApiCalls ? { apiCalls } : {}),
    ...(wantCounts
      ? {
          counts: {
            totalLookups,
            surepassHits,
            cacheReused,
          },
        }
      : {}),
    ...(wantExternalByVariant ? { externalByVariant } : {}),
    ...(wantExternalByProvider ? { externalByProvider } : {}),
    ...(wantCacheByVariant ? { cacheByVariant } : {}),
    ...(wantCacheByProvider ? { cacheByProvider } : {}),
    ...(wantByProvider ? { byProvider } : {}),
    ...(wantByVehicle
      ? {
          byVehicle: byVehicle.map((r) => ({
            registrationNumber: r.registration_number,
            surepassHits: Number(r.surepass_hits),
            cacheReused: Number(r.cache_reused),
            total: Number(r.total),
          })),
        }
      : {}),
    ...(wantByUser
      ? {
          byUser: byUser.map((r) => ({
            id: r.user_key === "guest" ? null : r.user_key,
            name: r.user_key === "guest" ? "Guest" : r.user_name ?? "",
            email: r.user_key === "guest" ? "" : r.user_email ?? "",
            surepassHits: Number(r.surepass_hits),
            cacheReused: Number(r.cache_reused),
            total: Number(r.total),
          })),
        }
      : {}),
    ...(wantRecent
      ? {
          recent: recent.map((r) => ({
            id: r.id,
            registrationNumber: r.registration_number,
            provider: r.provider,
            providerRef: r.provider_ref ? String(r.provider_ref) : null,
            providerBaseUrl: resolveProviderBaseUrl(r.provider_ref ? String(r.provider_ref) : null),
            providerVariant: classifyRcVariant(resolveProviderBaseUrl(r.provider_ref ? String(r.provider_ref) : null)),
            timestamp: r.created_at,
            user: r.user_id
              ? { id: r.user_id, name: r.user_name ?? "", email: r.user_email ?? "" }
              : { id: null, name: "Guest", email: "" },
          })),
        }
      : {}),
  })
}

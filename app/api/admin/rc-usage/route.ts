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
  if (value.includes("rc-full")) return "rc-full"
  if (value.includes("rc-v2")) return "rc-v2"
  if (value.includes("rc-lite")) return "rc-lite"
  return "unknown"
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const [{ totalLookups }] = await dbQuery<{ totalLookups: string | number }>(
    "SELECT COUNT(*) AS totalLookups FROM rc_documents WHERE provider IN ('external', 'cache')",
  )
  const [{ surepassHits }] = await dbQuery<{ surepassHits: string | number }>(
    "SELECT COUNT(*) AS surepassHits FROM rc_documents WHERE provider = 'external'",
  )
  const [{ cacheReused }] = await dbQuery<{ cacheReused: string | number }>(
    "SELECT COUNT(*) AS cacheReused FROM rc_documents WHERE provider = 'cache'",
  )

  const externalByProviderRef = await dbQuery<{ provider_ref: string | null; hits: string | number }>(
    `SELECT provider_ref, COUNT(*) AS hits
     FROM rc_documents
     WHERE provider = 'external'
     GROUP BY provider_ref
     ORDER BY hits DESC`,
  )

  const externalByProvider = externalByProviderRef.map((r) => {
    const providerRef = r.provider_ref ? String(r.provider_ref) : null
    const index = providerRef ? Number(providerRef) : NaN
    const baseUrl = Number.isFinite(index) && index > 0 ? readIndexedEnv("RC_API_BASE_URL", index) ?? null : null
    const variant = classifyRcVariant(baseUrl)
    return {
      providerRef,
      baseUrl,
      variant,
      hits: Number(r.hits),
    }
  })

  const externalByVariantMap = new Map<string, number>()
  for (const item of externalByProvider) {
    externalByVariantMap.set(item.variant, (externalByVariantMap.get(item.variant) || 0) + item.hits)
  }
  const externalByVariant = Array.from(externalByVariantMap.entries())
    .map(([variant, hits]) => ({ variant, hits }))
    .sort((a, b) => b.hits - a.hits)

  const byVehicle = await dbQuery<{
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

  const byUser = await dbQuery<{
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

  const recent = await dbQuery<{
    id: string
    registration_number: string
    provider: "external" | "cache"
    created_at: string
    user_id: string | null
    user_name: string | null
    user_email: string | null
  }>(
    `SELECT d.id,
            d.registration_number,
            d.provider,
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

  return NextResponse.json({
    ok: true,
    counts: {
      totalLookups: Number(totalLookups),
      surepassHits: Number(surepassHits),
      cacheReused: Number(cacheReused),
    },
    externalByVariant,
    externalByProvider,
    byVehicle: byVehicle.map((r) => ({
      registrationNumber: r.registration_number,
      surepassHits: Number(r.surepass_hits),
      cacheReused: Number(r.cache_reused),
      total: Number(r.total),
    })),
    byUser: byUser.map((r) => ({
      id: r.user_key === "guest" ? null : r.user_key,
      name: r.user_key === "guest" ? "Guest" : r.user_name ?? "",
      email: r.user_key === "guest" ? "" : r.user_email ?? "",
      surepassHits: Number(r.surepass_hits),
      cacheReused: Number(r.cache_reused),
      total: Number(r.total),
    })),
    recent: recent.map((r) => ({
      id: r.id,
      registrationNumber: r.registration_number,
      provider: r.provider,
      timestamp: r.created_at,
      user: r.user_id
        ? { id: r.user_id, name: r.user_name ?? "", email: r.user_email ?? "" }
        : { id: null, name: "Guest", email: "" },
    })),
  })
}

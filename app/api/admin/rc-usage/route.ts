import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"

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

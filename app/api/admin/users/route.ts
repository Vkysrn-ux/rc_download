import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const rows = await dbQuery<{
    id: string
    email: string
    name: string
    wallet_balance: string | number
    role: "user" | "admin"
    is_active: number
    rc_total: string | number | null
    rc_external: string | number | null
    rc_cache: string | number | null
  }>(
    `SELECT u.id,
            u.email,
            u.name,
            u.wallet_balance,
            u.role,
            u.is_active,
            COALESCE(r.total, 0) AS rc_total,
            COALESCE(r.external_hits, 0) AS rc_external,
            COALESCE(r.cache_hits, 0) AS rc_cache
     FROM users u
     LEFT JOIN (
       SELECT user_id,
              COUNT(*) AS total,
              SUM(provider = 'external') AS external_hits,
              SUM(provider = 'cache') AS cache_hits
       FROM rc_documents
       WHERE provider IN ('external', 'cache')
       GROUP BY user_id
     ) r ON r.user_id = u.id
     WHERE u.role = 'user'
     ORDER BY u.created_at DESC`,
  )

  return NextResponse.json({
    ok: true,
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      walletBalance: Number(u.wallet_balance),
      role: u.role,
      isActive: Boolean(u.is_active),
      rcLookups: {
        total: Number(u.rc_total || 0),
        external: Number(u.rc_external || 0),
        cache: Number(u.rc_cache || 0),
      },
    })),
  })
}


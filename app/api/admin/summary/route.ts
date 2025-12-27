import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const [{ totalUsers }] = await dbQuery<{ totalUsers: string | number }>(
    "SELECT COUNT(*) AS totalUsers FROM users WHERE role = 'user'",
  )
  const [{ activeUsers }] = await dbQuery<{ activeUsers: string | number }>(
    "SELECT COUNT(*) AS activeUsers FROM users WHERE role = 'user' AND wallet_balance > 0",
  )
  const [{ totalRevenue }] = await dbQuery<{ totalRevenue: string | number }>(
    "SELECT COALESCE(SUM(amount), 0) AS totalRevenue FROM transactions WHERE type = 'recharge' AND status = 'completed'",
  )
  const [{ totalDownloads }] = await dbQuery<{ totalDownloads: string | number }>(
    "SELECT COUNT(*) AS totalDownloads FROM transactions WHERE type = 'download'",
  )

  const [{ surepassHits }] = await dbQuery<{ surepassHits: string | number }>(
    "SELECT COUNT(*) AS surepassHits FROM rc_documents WHERE provider = 'external'",
  )
  const [{ cacheReused }] = await dbQuery<{ cacheReused: string | number }>(
    "SELECT COUNT(*) AS cacheReused FROM rc_documents WHERE provider = 'cache'",
  )

  const recent = await dbQuery<{
    id: string
    type: "recharge" | "download"
    amount: string | number
    status: "pending" | "completed" | "failed"
    description: string
    created_at: string
  }>(
    "SELECT id, type, amount, status, description, created_at FROM transactions ORDER BY created_at DESC LIMIT 5",
  )

  return NextResponse.json({
    ok: true,
    stats: {
      totalUsers: Number(totalUsers),
      activeUsers: Number(activeUsers),
      totalRevenue: Number(totalRevenue),
      totalDownloads: Number(totalDownloads),
      surepassHits: Number(surepassHits),
      cacheReused: Number(cacheReused),
    },
    recentTransactions: recent.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      status: t.status,
      description: t.description,
      timestamp: t.created_at,
    })),
  })
}

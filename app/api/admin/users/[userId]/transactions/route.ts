import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"

export async function GET(_req: Request, ctx: { params: { userId: string } }) {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const { userId } = ctx.params
  if (!userId) return NextResponse.json({ ok: false, error: "Invalid user" }, { status: 400 })

  const rows = await dbQuery<{
    id: string
    user_id: string | null
    type: "recharge" | "download"
    amount: string | number
    status: "pending" | "completed" | "failed"
    description: string
    registration_number: string | null
    created_at: string
  }>(
    "SELECT id, user_id, type, amount, status, description, registration_number, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  )

  return NextResponse.json({
    ok: true,
    transactions: rows.map((t) => ({
      id: t.id,
      userId: t.user_id,
      type: t.type,
      amount: Number(t.amount),
      status: t.status,
      description: t.description,
      registrationNumber: t.registration_number,
      timestamp: t.created_at,
    })),
  })
}

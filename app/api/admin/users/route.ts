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
  }>("SELECT id, email, name, wallet_balance, role, is_active FROM users WHERE role = 'user' ORDER BY created_at DESC")

  return NextResponse.json({
    ok: true,
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      walletBalance: Number(u.wallet_balance),
      role: u.role,
      isActive: Boolean(u.is_active),
    })),
  })
}


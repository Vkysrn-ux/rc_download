import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const rows = await dbQuery<{
    id: string
    user_id: string | null
    user_email: string | null
    user_name: string | null
    type: "recharge" | "download"
    amount: string | number
    status: "pending" | "completed" | "failed"
    payment_method: "wallet" | "upi" | null
    description: string
    registration_number: string | null
    created_at: string
  }>(
    `SELECT t.id, t.user_id, u.email AS user_email, u.name AS user_name, t.type, t.amount, t.status, t.payment_method, t.description, t.registration_number, t.created_at
     FROM transactions t
     LEFT JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC`,
  )

  return NextResponse.json({
    ok: true,
    transactions: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userEmail: r.user_email,
      userName: r.user_name,
      type: r.type,
      amount: Number(r.amount),
      status: r.status,
      paymentMethod: r.payment_method,
      description: r.description,
      registrationNumber: r.registration_number,
      timestamp: r.created_at,
    })),
  })
}


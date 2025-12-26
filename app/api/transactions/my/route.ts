import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const rows = await dbQuery<{
    id: string
    type: "recharge" | "download"
    amount: string | number
    status: "pending" | "completed" | "failed"
    payment_method: "wallet" | "upi" | null
    description: string
    registration_number: string | null
    created_at: string
  }>(
    "SELECT id, type, amount, status, payment_method, description, registration_number, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC",
    [user.id],
  )

  return NextResponse.json({
    ok: true,
    transactions: rows.map((r) => ({
      id: r.id,
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


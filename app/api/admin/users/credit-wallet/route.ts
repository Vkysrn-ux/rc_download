import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"

const CreditSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive().max(100000),
  reason: z.string().max(200).optional(),
})

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = CreditSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const { userId, amount, reason } = parsed.data
  const description = `Admin Credit: ${reason || "Manual wallet credit"}`
  const transactionId = crypto.randomUUID()

  await dbQuery("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ? AND role = 'user'", [amount, userId])
  await dbQuery(
    "INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description) VALUES (?, ?, 'recharge', ?, 'completed', 'wallet', ?)",
    [transactionId, userId, amount, description],
  )

  const rows = await dbQuery<{ wallet_balance: string | number }>("SELECT wallet_balance FROM users WHERE id = ? LIMIT 1", [
    userId,
  ])

  return NextResponse.json({ ok: true, transactionId, walletBalance: Number(rows[0]?.wallet_balance ?? 0) })
}


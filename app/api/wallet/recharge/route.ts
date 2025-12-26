import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"

const RechargeSchema = z.object({
  amount: z.number().positive().max(100000),
})

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = RechargeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const autoApprove = (process.env.PAYMENT_AUTO_APPROVE ?? "").toLowerCase() === "true"
  const id = crypto.randomUUID()
  const amount = parsed.data.amount
  const status = autoApprove ? "completed" : "pending"

  await dbQuery(
    "INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description) VALUES (?, ?, 'recharge', ?, ?, 'upi', ?)",
    [id, user.id, amount, status, "Wallet recharge via UPI"],
  )

  let walletBalance = user.walletBalance
  if (autoApprove) {
    await dbQuery("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, user.id])
    const rows = await dbQuery<{ wallet_balance: string | number }>(
      "SELECT wallet_balance FROM users WHERE id = ? LIMIT 1",
      [user.id],
    )
    walletBalance = Number(rows[0]?.wallet_balance ?? walletBalance)
  }

  return NextResponse.json({ ok: true, transactionId: id, status, walletBalance })
}


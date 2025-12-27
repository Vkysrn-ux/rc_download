import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"
import { getCurrentUser } from "@/lib/server/session"

const PurchaseSchema = z.object({
  registrationNumber: z.string().min(4).max(32),
  paymentMethod: z.enum(["wallet", "upi"]),
  guest: z.boolean().optional(),
})

function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/\s/g, "")
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = PurchaseSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const user = await getCurrentUser().catch(() => null)
  const isGuest = parsed.data.guest === true || !user
  const price = isGuest ? 30 : 20
  const registrationNumber = normalizeRegistration(parsed.data.registrationNumber)

  const autoApprove = (process.env.PAYMENT_AUTO_APPROVE ?? "").toLowerCase() === "true"

  if (parsed.data.paymentMethod === "wallet") {
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const balances = await dbQuery<{ wallet_balance: string | number }>(
      "SELECT wallet_balance FROM users WHERE id = ? LIMIT 1",
      [user.id],
    )
    const walletBalance = Number(balances[0]?.wallet_balance ?? 0)
    if (walletBalance < price) return NextResponse.json({ ok: false, error: "Insufficient wallet balance" }, { status: 400 })

    const txnId = crypto.randomUUID()
    await dbQuery("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [price, user.id])
    await dbQuery(
      "INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description, registration_number) VALUES (?, ?, 'download', ?, 'completed', 'wallet', ?, ?)",
      [txnId, user.id, -price, `Vehicle RC Download - ${registrationNumber}`, registrationNumber],
    )

    return NextResponse.json({ ok: true, status: "completed", transactionId: txnId })
  }

  // UPI payment: record transaction (pending unless autoApprove)
  const txnId = crypto.randomUUID()
  const status = autoApprove ? "completed" : "pending"
  const userId = user?.id ?? null

  await dbQuery(
    "INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description, registration_number) VALUES (?, ?, 'download', ?, ?, 'upi', ?, ?)",
    [txnId, userId, -price, status, `Vehicle RC Download - ${registrationNumber}`, registrationNumber],
  )

  return NextResponse.json({ ok: true, status, transactionId: txnId })
}

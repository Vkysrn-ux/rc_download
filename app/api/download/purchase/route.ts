import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"
import { getCurrentUser } from "@/lib/server/session"
import { WalletError, chargeWalletForDownload } from "@/lib/server/wallet"

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
    // Wallet downloads are for logged-in users only; ignore `guest` flag for pricing.
    try {
      const charged = await chargeWalletForDownload({
        userId: user.id,
        registrationNumber,
        price: 20,
        description: `Vehicle RC Download - ${registrationNumber}`,
      })
      return NextResponse.json({ ok: true, status: "completed", transactionId: charged.transactionId, walletBalance: charged.walletBalance })
    } catch (error: any) {
      if (error instanceof WalletError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
      }
      return NextResponse.json({ ok: false, error: "Unable to process wallet payment" }, { status: 500 })
    }
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

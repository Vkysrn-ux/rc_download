import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"
import { getCurrentUser } from "@/lib/server/session"
import { getRazorpayConfig, razorpayFetch } from "@/lib/server/razorpay"

const CreateOrderSchema = z.discriminatedUnion("purpose", [
  z.object({
    purpose: z.literal("download"),
    registrationNumber: z.string().min(4).max(32),
    guest: z.boolean().optional(),
  }),
  z.object({
    purpose: z.literal("recharge"),
    amount: z.number().positive().max(100000),
  }),
])

function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/\s/g, "")
}

function toPaise(rupees: number) {
  return Math.round(rupees * 100)
}

export async function POST(req: Request) {
  const razorpayEnabled = (process.env.PAYMENTS_ENABLE_RAZORPAY ?? "").toLowerCase() === "true"
  if (!razorpayEnabled) {
    return NextResponse.json({ ok: false, error: "Razorpay is temporarily disabled." }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  let keyId = ""
  try {
    keyId = getRazorpayConfig().keyId
  } catch {
    return NextResponse.json(
      { ok: false, error: "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
      { status: 500 },
    )
  }
  const user = await getCurrentUser().catch(() => null)

  let transactionId = crypto.randomUUID()
  let amountRupees = 0
  let type: "recharge" | "download" = "download"
  let description = ""
  let registrationNumber: string | null = null
  let userId: string | null = user?.id ?? null

  if (parsed.data.purpose === "download") {
    const isGuest = parsed.data.guest === true || !user
    amountRupees = isGuest ? 30 : 20
    type = "download"
    registrationNumber = normalizeRegistration(parsed.data.registrationNumber)
    description = `Vehicle RC Download - ${registrationNumber}`
    userId = user?.id ?? null
  } else {
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    amountRupees = parsed.data.amount
    type = "recharge"
    description = "Wallet recharge via Razorpay"
    userId = user.id
  }

  const amountPaise = toPaise(amountRupees)
  if (!amountPaise || amountPaise < 100) {
    return NextResponse.json({ ok: false, error: "Amount too low" }, { status: 400 })
  }

  const payeeName = process.env.PAYMENT_PAYEE_NAME || "Vehicle RC Download"
  let order: { id: string; amount: number; currency: string; status: string }
  try {
    order = await razorpayFetch<{ id: string; amount: number; currency: string; status: string }>(`/orders`, {
      method: "POST",
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: transactionId,
        notes: {
          purpose: parsed.data.purpose,
          registrationNumber: registrationNumber ?? "",
          userId: userId ?? "",
        },
      }),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to create order" }, { status: 502 })
  }

  const amountSigned = type === "download" ? -amountRupees : amountRupees
  await dbQuery(
    "INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description, registration_number, gateway, gateway_order_id) VALUES (?, ?, ?, ?, 'pending', 'razorpay', ?, ?, 'razorpay', ?)",
    [transactionId, userId, type, amountSigned, description, registrationNumber, order.id],
  )

  return NextResponse.json({
    ok: true,
    keyId,
    orderId: order.id,
    amount: amountPaise,
    currency: order.currency || "INR",
    transactionId,
    name: payeeName,
    description,
    prefill: user ? { name: user.name, email: user.email } : null,
  })
}

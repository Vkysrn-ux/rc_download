import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"
import { getCurrentUser } from "@/lib/server/session"
import { cashfreeFetch, getCashfreeConfig } from "@/lib/server/cashfree"

const CreateOrderSchema = z.discriminatedUnion("purpose", [
  z.object({
    purpose: z.literal("download"),
    registrationNumber: z.string().min(4).max(32),
    guest: z.boolean().optional(),
    customerName: z.string().min(2).max(80).optional(),
    customerEmail: z.string().email().max(255).optional(),
    customerPhone: z.string().min(6).max(20).optional(),
  }),
  z.object({
    purpose: z.literal("recharge"),
    amount: z.number().positive().max(100000),
    customerName: z.string().min(2).max(80).optional(),
    customerEmail: z.string().email().max(255).optional(),
    customerPhone: z.string().min(6).max(20).optional(),
  }),
])

function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/\s/g, "")
}

function normalizePhone(value: string) {
  return (value || "").replace(/[^\d+]/g, "")
}

function makeOrderId(transactionId: string) {
  const compact = transactionId.replace(/-/g, "")
  return `rc_${compact.slice(0, 26)}`
}

async function insertCashfreeTransaction(params: {
  transactionId: string
  userId: string | null
  type: "download" | "recharge"
  amount: number
  description: string
  registrationNumber: string | null
  orderId: string
}) {
  const query =
    "INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description, registration_number, gateway, gateway_order_id) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, 'cashfree', ?)"
  try {
    await dbQuery(query, [
      params.transactionId,
      params.userId,
      params.type,
      params.amount,
      "cashfree",
      params.description,
      params.registrationNumber,
      params.orderId,
    ])
  } catch {
    await dbQuery(query, [
      params.transactionId,
      params.userId,
      params.type,
      params.amount,
      null,
      params.description,
      params.registrationNumber,
      params.orderId,
    ])
  }
}

export async function POST(req: Request) {
  const cashfreeEnabled = (process.env.PAYMENTS_ENABLE_CASHFREE ?? "").toLowerCase() === "true"
  if (!cashfreeEnabled) {
    return NextResponse.json({ ok: false, error: "Cashfree is temporarily disabled." }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const appBaseUrl = process.env.APP_BASE_URL || new URL(req.url).origin
  const user = await getCurrentUser().catch(() => null)

  let transactionId = crypto.randomUUID()
  const orderId = makeOrderId(transactionId)

  let amountRupees = 0
  let type: "download" | "recharge" = "download"
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
    description = "Wallet recharge via Cashfree"
    userId = user.id
  }

  const customerEmailFromBody = "customerEmail" in parsed.data ? parsed.data.customerEmail : undefined
  const customerNameFromBody = "customerName" in parsed.data ? parsed.data.customerName : undefined
  const customerPhoneFromBody = "customerPhone" in parsed.data ? parsed.data.customerPhone : undefined

  const customerEmail = user?.email || customerEmailFromBody || ""
  let customerName = user?.name || customerNameFromBody || "Customer"
  let customerPhone = ""
  if (userId) {
    const rows = await dbQuery<{ phone: string | null }>("SELECT phone FROM users WHERE id = ? LIMIT 1", [userId])
    customerPhone = normalizePhone(rows[0]?.phone ?? "")
  }
  if (!customerPhone) {
    customerPhone = normalizePhone(customerPhoneFromBody ?? "")
  }

  if (!customerEmail || !customerPhone) {
    return NextResponse.json(
      { ok: false, error: "Missing customer email/phone for payment. Please add a phone number to your account or enter it at checkout." },
      { status: 400 },
    )
  }

  if (!customerName || customerName.length < 2) customerName = "Customer"

  const returnUrlBase = `${appBaseUrl}/payment/cashfree/return?transactionId=${encodeURIComponent(transactionId)}`
  const returnUrl =
    type === "download"
      ? `${returnUrlBase}&registration=${encodeURIComponent(registrationNumber || "")}`
      : `${returnUrlBase}&recharge=1`

  let order: {
    payment_session_id: string
    order_id: string
    order_status?: string
    order_amount?: number
    order_currency?: string
  }
  try {
    order = await cashfreeFetch<typeof order>("/pg/orders", {
      method: "POST",
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amountRupees,
        order_currency: "INR",
        customer_details: {
          customer_id: userId || "guest",
          customer_email: customerEmail,
          customer_phone: customerPhone,
          customer_name: customerName,
        },
        order_meta: {
          return_url: returnUrl,
        },
        order_note: description,
      }),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to create order" }, { status: 502 })
  }

  const amountSigned = type === "download" ? -amountRupees : amountRupees
  await insertCashfreeTransaction({
    transactionId,
    userId,
    type,
    amount: amountSigned,
    description,
    registrationNumber,
    orderId: orderId,
  })

  const { mode } = getCashfreeConfig()
  return NextResponse.json({
    ok: true,
    mode,
    paymentSessionId: order.payment_session_id,
    transactionId,
    orderId,
    amount: amountRupees,
    currency: "INR",
  })
}

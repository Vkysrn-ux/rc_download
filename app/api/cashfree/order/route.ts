import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"
import { getCurrentUser } from "@/lib/server/session"
import { cashfreeFetch, getCashfreeConfig } from "@/lib/server/cashfree"
import {
  getPanDetailsPriceInr,
  getRcDownloadPriceInr,
  getRcOwnerHistoryPriceInr,
  getRcToMobilePriceInr,
  MIN_WALLET_RECHARGE_INR,
} from "@/lib/pricing"

const CreateOrderSchema = z.discriminatedUnion("purpose", [
  z.object({
    purpose: z.literal("download"),
    registrationNumber: z.string().min(4).max(32),
    guest: z.boolean().optional(),
    customerName: z.string().max(80).optional(),
    customerEmail: z.string().max(255).optional(),
    customerPhone: z.string().max(30).optional(),
  }),
  z.object({
    purpose: z.literal("pan_details"),
    panNumber: z.string().min(5).max(32),
    guest: z.boolean().optional(),
    customerName: z.string().max(80).optional(),
    customerEmail: z.string().max(255).optional(),
    customerPhone: z.string().max(30).optional(),
  }),
  z.object({
    purpose: z.literal("rc_to_mobile"),
    registrationNumber: z.string().min(4).max(32),
    guest: z.boolean().optional(),
    customerName: z.string().max(80).optional(),
    customerEmail: z.string().max(255).optional(),
    customerPhone: z.string().max(30).optional(),
  }),
  z.object({
    purpose: z.literal("rc_owner_history"),
    registrationNumber: z.string().min(4).max(32),
    guest: z.boolean().optional(),
    customerName: z.string().max(80).optional(),
    customerEmail: z.string().max(255).optional(),
    customerPhone: z.string().max(30).optional(),
  }),
  z.object({
    purpose: z.literal("recharge"),
    amount: z.number().min(MIN_WALLET_RECHARGE_INR).max(100000),
    customerName: z.string().max(80).optional(),
    customerEmail: z.string().max(255).optional(),
    customerPhone: z.string().max(30).optional(),
  }),
])

function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/\s/g, "")
}

function normalizePhone(value: string) {
  const digits = (value || "").replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2)
  return digits
}

function isValidEmail(value: string) {
  return z.string().email().max(255).safeParse((value || "").trim()).success
}

function isValidPhone(value: string) {
  const digits = (value || "").replace(/\D/g, "")
  return digits.length >= 10 && digits.length <= 15
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
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid input",
        details: process.env.NODE_ENV === "production" ? undefined : parsed.error.flatten(),
      },
      { status: 400 },
    )
  }

  const requestOrigin = new URL(req.url).origin
  const appBaseUrlRaw = process.env.APP_BASE_URL || requestOrigin
  let appBaseUrl = appBaseUrlRaw
  try {
    const parsedEnvUrl = new URL(appBaseUrlRaw)
    if (["localhost", "127.0.0.1"].includes(parsedEnvUrl.hostname)) {
      appBaseUrl = requestOrigin
    }
  } catch {
    appBaseUrl = requestOrigin
  }
  const user = await getCurrentUser().catch(() => null)
  if (
    (parsed.data.purpose === "download" ||
      parsed.data.purpose === "pan_details" ||
      parsed.data.purpose === "rc_to_mobile" ||
      parsed.data.purpose === "rc_owner_history") &&
    user
  ) {
    return NextResponse.json({ ok: false, error: "Registered users must pay via wallet." }, { status: 403 })
  }

  let transactionId = crypto.randomUUID()
  const orderId = makeOrderId(transactionId)

  let amountRupees = 0
  let type: "download" | "recharge" = "download"
  let description = ""
  let registrationNumber: string | null = null
  let userId: string | null = user?.id ?? null

  if (parsed.data.purpose === "download") {
    const isGuest = parsed.data.guest === true || !user
    amountRupees = getRcDownloadPriceInr(isGuest)
    type = "download"
    registrationNumber = normalizeRegistration(parsed.data.registrationNumber)
    userId = user?.id ?? null
  } else if (parsed.data.purpose === "pan_details") {
    const isGuest = parsed.data.guest === true || !user
    amountRupees = getPanDetailsPriceInr(isGuest)
    type = "download"
    registrationNumber = normalizeRegistration(parsed.data.panNumber)
    userId = user?.id ?? null
  } else if (parsed.data.purpose === "rc_to_mobile") {
    const isGuest = parsed.data.guest === true || !user
    amountRupees = getRcToMobilePriceInr(isGuest)
    type = "download"
    registrationNumber = normalizeRegistration(parsed.data.registrationNumber)
    userId = user?.id ?? null
  } else if (parsed.data.purpose === "rc_owner_history") {
    const isGuest = parsed.data.guest === true || !user
    amountRupees = getRcOwnerHistoryPriceInr(isGuest)
    type = "download"
    registrationNumber = normalizeRegistration(parsed.data.registrationNumber)
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

  const customerEmailCandidate = (user?.email || customerEmailFromBody || "").trim()
  const customerEmail = isValidEmail(customerEmailCandidate) ? customerEmailCandidate : ""

  const customerNameCandidate = (user?.name || customerNameFromBody || "").trim()
  let customerName = customerNameCandidate || "Customer"

  let customerPhone = ""
  if (userId) {
    const rows = await dbQuery<{ phone: string | null }>("SELECT phone FROM users WHERE id = ? LIMIT 1", [userId])
    customerPhone = normalizePhone(rows[0]?.phone ?? "")
  }
  if (!customerPhone) {
    customerPhone = normalizePhone(customerPhoneFromBody ?? "")
  }

  // Customer phone is optional for guest flows; Cashfree customer details will include it only if provided.
  if (type === "download" && !userId) {
    if (!customerPhone || !isValidPhone(customerPhone)) {
      return NextResponse.json({ ok: false, error: "Customer phone is required for payment." }, { status: 400 })
    }
  }

  if (!customerName || customerName.length < 2) customerName = "Customer"
  // build description now that customer phone/registration are known
  if (type === "download") {
    const isGuest =
      (parsed.data.purpose === "download" ||
        parsed.data.purpose === "pan_details" ||
        parsed.data.purpose === "rc_to_mobile" ||
        parsed.data.purpose === "rc_owner_history") &&
      (parsed.data.guest === true || !user)
    // include phone in description for guest downloads so admins can see it in recent activity
    const phoneSuffix = customerPhone ? ` - ${customerPhone}` : ""
    description =
      parsed.data.purpose === "pan_details"
        ? `PAN Details - ${registrationNumber}${phoneSuffix}`
        : parsed.data.purpose === "rc_to_mobile"
          ? `RC to Mobile - ${registrationNumber}${phoneSuffix}`
          : parsed.data.purpose === "rc_owner_history"
            ? `RC Owner History - ${registrationNumber}${phoneSuffix}`
        : `Vehicle RC Download - ${registrationNumber}${phoneSuffix}`
  }

  if (getCashfreeConfig().mode === "production") {
    try {
      const parsedBase = new URL(appBaseUrl)
      if (parsedBase.protocol !== "https:") {
        parsedBase.protocol = "https:"
        appBaseUrl = parsedBase.toString().replace(/\/$/, "")
      }
    } catch {}
  }

  const returnUrlBase = `${appBaseUrl}/payment/cashfree/return?transactionId=${encodeURIComponent(transactionId)}`
  const returnUrl =
    type === "download"
      ? parsed.data.purpose === "pan_details"
        ? `${returnUrlBase}&purpose=pan_details&pan=${encodeURIComponent(registrationNumber || "")}`
        : parsed.data.purpose === "rc_to_mobile"
          ? `${returnUrlBase}&purpose=rc_to_mobile&registration=${encodeURIComponent(registrationNumber || "")}`
          : parsed.data.purpose === "rc_owner_history"
            ? `${returnUrlBase}&purpose=rc_owner_history&registration=${encodeURIComponent(registrationNumber || "")}`
            : `${returnUrlBase}&registration=${encodeURIComponent(registrationNumber || "")}`
      : `${returnUrlBase}&recharge=1`

  let order: {
    payment_session_id: string
    order_id: string
    order_status?: string
    order_amount?: number
    order_currency?: string
  }
  try {
    const customerDetails: Record<string, unknown> = {
      customer_id: userId || "guest",
      customer_name: customerName,
    }
    if (customerEmail) customerDetails.customer_email = customerEmail
    if (customerPhone) customerDetails.customer_phone = customerPhone

    order = await cashfreeFetch<typeof order>("/pg/orders", {
      method: "POST",
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amountRupees,
        order_currency: "INR",
        customer_details: customerDetails,
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

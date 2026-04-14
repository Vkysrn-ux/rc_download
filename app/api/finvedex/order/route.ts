import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"
import { getCurrentUser } from "@/lib/server/session"
import { createFinvedexOrder, makeFinvedexOrderId } from "@/lib/server/finvedex"
import { getPanDetailsPriceInr, getRcDownloadPriceInr, getRcOwnerHistoryPriceInr, getRcToMobilePriceInr } from "@/lib/pricing"

const CreateOrderSchema = z.discriminatedUnion("purpose", [
  z.object({
    purpose: z.literal("download"),
    registrationNumber: z.string().min(4).max(32),
    customerPhone: z.string().max(30),
    guest: z.boolean().optional(),
  }),
  z.object({
    purpose: z.literal("pan_details"),
    panNumber: z.string().min(5).max(32),
    customerPhone: z.string().max(30),
    guest: z.boolean().optional(),
  }),
  z.object({
    purpose: z.literal("rc_to_mobile"),
    registrationNumber: z.string().min(4).max(32),
    customerPhone: z.string().max(30),
    guest: z.boolean().optional(),
  }),
  z.object({
    purpose: z.literal("rc_owner_history"),
    registrationNumber: z.string().min(4).max(32),
    customerPhone: z.string().max(30),
    guest: z.boolean().optional(),
  }),
  z.object({
    purpose: z.literal("recharge"),
    amount: z.number().min(1),
    customerPhone: z.string().max(30),
  }),
])

function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/\s/g, "")
}

function normalizePhone(value: string) {
  const digits = (value || "").replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1)
  return digits
}

export async function POST(req: Request) {
  const enabled = (process.env.PAYMENTS_ENABLE_FINVEDEX ?? "").toLowerCase() === "true"
  if (!enabled) {
    return NextResponse.json({ ok: false, error: "Finvedex payments are not enabled." }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })
  }

  const user = await getCurrentUser().catch(() => null)

  // Only guest purchases are allowed except for recharge (logged-in users recharge their wallet)
  if (parsed.data.purpose !== "recharge" && user) {
    return NextResponse.json({ ok: false, error: "Registered users must pay via wallet." }, { status: 403 })
  }

  const requestOrigin = new URL(req.url).origin
  const appBaseUrl = process.env.APP_BASE_URL || requestOrigin

  const transactionId = crypto.randomUUID()
  const orderId = makeFinvedexOrderId(transactionId)
  const isGuest = !user

  let amountRupees = 0
  let registrationNumber: string | null = null
  let description = ""
  let txnType = "download"

  const phone = normalizePhone(parsed.data.customerPhone)
  if (!phone || phone.length < 10 || phone.length > 15) {
    return NextResponse.json({ ok: false, error: "Valid customer phone is required." }, { status: 400 })
  }

  if (parsed.data.purpose === "download") {
    amountRupees = getRcDownloadPriceInr(isGuest)
    registrationNumber = normalizeRegistration(parsed.data.registrationNumber)
    description = `Vehicle RC Download - ${registrationNumber} - ${phone}`
  } else if (parsed.data.purpose === "pan_details") {
    amountRupees = getPanDetailsPriceInr(isGuest)
    registrationNumber = normalizeRegistration(parsed.data.panNumber)
    description = `PAN Details - ${registrationNumber} - ${phone}`
  } else if (parsed.data.purpose === "rc_to_mobile") {
    amountRupees = getRcToMobilePriceInr(isGuest)
    registrationNumber = normalizeRegistration(parsed.data.registrationNumber)
    description = `RC to Mobile - ${registrationNumber} - ${phone}`
  } else if (parsed.data.purpose === "rc_owner_history") {
    amountRupees = getRcOwnerHistoryPriceInr(isGuest)
    registrationNumber = normalizeRegistration(parsed.data.registrationNumber)
    description = `RC Owner History - ${registrationNumber} - ${phone}`
  } else if (parsed.data.purpose === "recharge") {
    amountRupees = parsed.data.amount
    txnType = "recharge"
    description = `Wallet Recharge - ${phone}`
  }

  const purposeParam = parsed.data.purpose
  const refParam = purposeParam === "pan_details"
    ? `&pan=${encodeURIComponent(registrationNumber || "")}`
    : purposeParam === "recharge"
    ? ""
    : `&registration=${encodeURIComponent(registrationNumber || "")}`

  const redirectUrl = `${appBaseUrl}/payment/finvedex/return?transactionId=${encodeURIComponent(transactionId)}&purpose=${encodeURIComponent(purposeParam)}${refParam}`

  let paymentUrl = ""
  try {
    const result = await createFinvedexOrder({
      customerMobile: phone,
      amount: amountRupees,
      orderId,
      redirectUrl,
      remark1: registrationNumber || purposeParam,
      remark2: transactionId,
    })
    paymentUrl = result.paymentUrl
  } catch (e: any) {
    console.error("[finvedex order] error:", e?.message)
    return NextResponse.json({ ok: false, error: e?.message || "Failed to create Finvedex order" }, { status: 502 })
  }

  const userId = user?.id ?? null

  try {
    await dbQuery(
      "INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description, registration_number, gateway, gateway_order_id) VALUES (?, ?, ?, ?, 'pending', 'finvedex', ?, ?, 'finvedex', ?)",
      [transactionId, userId, txnType, txnType === "recharge" ? amountRupees : -amountRupees, description, registrationNumber, orderId],
    ).catch(async () => {
      await dbQuery(
        "INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description, registration_number) VALUES (?, ?, ?, ?, 'pending', 'finvedex', ?, ?)",
        [transactionId, userId, txnType, txnType === "recharge" ? amountRupees : -amountRupees, description, registrationNumber],
      ).catch(() => {})
    })
  } catch {
    // DB logging is best-effort — don't block payment redirect on DB failure
    console.error("[finvedex order] failed to save transaction", transactionId)
  }

  return NextResponse.json({ ok: true, paymentUrl, transactionId, orderId, amount: amountRupees })
}

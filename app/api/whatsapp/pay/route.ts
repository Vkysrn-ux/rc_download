import { NextResponse } from "next/server"
import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"
import { createFinvedexOrder, makeFinvedexOrderId } from "@/lib/server/finvedex"
import {
  GUEST_RC_DOWNLOAD_PRICE_INR,
  GUEST_PAN_DETAILS_PRICE_INR,
  GUEST_RC_TO_MOBILE_PRICE_INR,
  GUEST_RC_OWNER_HISTORY_PRICE_INR,
} from "@/lib/pricing"

const SERVICE_LABELS: Record<string, string> = {
  rc: "RC Download",
  pan: "PAN Details",
  mobile: "RC to Mobile",
  owner: "Owner History",
}

function servicePrice(service: string): number {
  if (service === "rc") return GUEST_RC_DOWNLOAD_PRICE_INR
  if (service === "pan") return GUEST_PAN_DETAILS_PRICE_INR
  if (service === "mobile") return GUEST_RC_TO_MOBILE_PRICE_INR
  if (service === "owner") return GUEST_RC_OWNER_HISTORY_PRICE_INR
  return GUEST_RC_DOWNLOAD_PRICE_INR
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const id = (body?.id || "").trim()
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 })

  const rows = await dbQuery<{
    id: string
    phone: string
    service: string
    query: string
    order_id: string
    status: string
  }>(
    "SELECT id, phone, service, query, order_id, status FROM whatsapp_pending_requests WHERE id = ? LIMIT 1",
    [id],
  )
  const pending = rows[0]
  if (!pending) return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 })
  if (pending.status !== "pending") return NextResponse.json({ ok: false, error: "Already paid" }, { status: 409 })

  const amount = servicePrice(pending.service)
  const orderId = pending.order_id || makeFinvedexOrderId(pending.id)
  const transactionId = crypto.randomUUID()

  const requestOrigin = new URL(req.url).origin
  const configuredBase = (process.env.APP_BASE_URL || "").replace(/\/$/, "")
  const appBaseUrl = configuredBase && !configuredBase.includes("localhost") ? configuredBase : requestOrigin

  const redirectUrl = `${appBaseUrl}/pay/whatsapp/success?id=${encodeURIComponent(pending.id)}`

  let paymentUrl: string
  try {
    const result = await createFinvedexOrder({
      customerMobile: pending.phone.replace(/^91/, "").slice(-10),
      amount,
      orderId,
      redirectUrl,
      remark1: pending.phone,
      remark2: `wa:${pending.service}:${pending.query}`,
    })
    paymentUrl = result.paymentUrl
  } catch (err: any) {
    console.error("[wa-pay] Finvedex order failed:", err?.message)
    return NextResponse.json({ ok: false, error: err?.message || "Payment creation failed" }, { status: 502 })
  }

  await dbQuery(
    `INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description, registration_number, gateway, gateway_order_id)
     VALUES (?, NULL, 'download', ?, 'pending', 'finvedex', ?, ?, 'finvedex', ?)`,
    [transactionId, -amount, `WhatsApp ${SERVICE_LABELS[pending.service] || pending.service} - ${pending.query}`, pending.query, orderId],
  ).catch(async () => {
    await dbQuery(
      `INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description, registration_number, gateway_order_id)
       VALUES (?, NULL, 'download', ?, 'pending', 'finvedex', ?, ?, ?)`,
      [transactionId, -amount, `WhatsApp ${SERVICE_LABELS[pending.service] || pending.service} - ${pending.query}`, pending.query, orderId],
    ).catch(() => {})
  })

  return NextResponse.json({ ok: true, paymentUrl })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get("id") || ""
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 })

  const rows = await dbQuery<{
    id: string
    phone: string
    service: string
    query: string
    status: string
  }>(
    "SELECT id, phone, service, query, status FROM whatsapp_pending_requests WHERE id = ? LIMIT 1",
    [id],
  )
  const pending = rows[0]
  if (!pending) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

  return NextResponse.json({
    ok: true,
    service: pending.service,
    label: SERVICE_LABELS[pending.service] || pending.service,
    query: pending.query,
    amount: servicePrice(pending.service),
    status: pending.status,
    phone: pending.phone.slice(-4).padStart(pending.phone.length, "*"),
  })
}

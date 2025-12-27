import { NextResponse } from "next/server"
import { z } from "zod"
import { dbQuery } from "@/lib/server/db"
import { verifyRazorpaySignature, razorpayFetch } from "@/lib/server/razorpay"

const VerifySchema = z.object({
  transactionId: z.string().uuid(),
  razorpay_order_id: z.string().min(5),
  razorpay_payment_id: z.string().min(5),
  razorpay_signature: z.string().min(10),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = VerifySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const { transactionId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data

  try {
    // Ensure env vars are present before any verification work.
    verifyRazorpaySignature({ orderId: "order_x", paymentId: "pay_x", signature: "0".repeat(64) })
  } catch {
    return NextResponse.json(
      { ok: false, error: "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
      { status: 500 },
    )
  }

  const rows = await dbQuery<{
    id: string
    user_id: string | null
    type: "recharge" | "download"
    amount: string | number
    status: "pending" | "completed" | "failed"
    gateway_order_id: string | null
  }>("SELECT id, user_id, type, amount, status, gateway_order_id FROM transactions WHERE id = ? LIMIT 1", [transactionId])

  const txn = rows[0]
  if (!txn) return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 404 })
  if (txn.status === "completed") return NextResponse.json({ ok: true })
  if (txn.gateway_order_id && txn.gateway_order_id !== razorpay_order_id) {
    return NextResponse.json({ ok: false, error: "Order mismatch" }, { status: 400 })
  }

  const signatureOk = verifyRazorpaySignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  })
  if (!signatureOk) return NextResponse.json({ ok: false, error: "Signature verification failed" }, { status: 400 })

  let order: { id: string; amount: number; currency: string; status: string }
  try {
    order = await razorpayFetch<{ id: string; amount: number; currency: string; status: string }>(
      `/orders/${encodeURIComponent(razorpay_order_id)}`,
      { method: "GET" },
    )
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to fetch order" }, { status: 502 })
  }

  const expectedAmountPaise = Math.round(Math.abs(Number(txn.amount)) * 100)
  if (order.amount !== expectedAmountPaise || (order.currency || "INR") !== "INR") {
    return NextResponse.json({ ok: false, error: "Amount mismatch" }, { status: 400 })
  }
  if ((order.status || "").toLowerCase() !== "paid") {
    return NextResponse.json({ ok: false, error: "Order not paid yet" }, { status: 400 })
  }

  await dbQuery(
    "UPDATE transactions SET status = 'completed', gateway_payment_id = ?, gateway_signature = ?, gateway_order_id = COALESCE(gateway_order_id, ?) WHERE id = ?",
    [razorpay_payment_id, razorpay_signature, razorpay_order_id, transactionId],
  )

  if (txn.type === "recharge" && txn.user_id) {
    await dbQuery("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [Number(txn.amount), txn.user_id])
  }

  return NextResponse.json({ ok: true })
}

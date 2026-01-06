import { NextResponse } from "next/server"
import { z } from "zod"
import { dbQuery } from "@/lib/server/db"
import { cashfreeFetch } from "@/lib/server/cashfree"

const VerifySchema = z.object({
  transactionId: z.string().uuid(),
})

export async function POST(req: Request) {
  const cashfreeEnabled = (process.env.PAYMENTS_ENABLE_CASHFREE ?? "").toLowerCase() === "true"
  if (!cashfreeEnabled) {
    return NextResponse.json({ ok: false, error: "Cashfree is temporarily disabled." }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const parsed = VerifySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const rows = await dbQuery<{
    id: string
    user_id: string | null
    type: "recharge" | "download"
    amount: string | number
    status: "pending" | "completed" | "failed"
    gateway_order_id: string | null
  }>("SELECT id, user_id, type, amount, status, gateway_order_id FROM transactions WHERE id = ? LIMIT 1", [
    parsed.data.transactionId,
  ])

  const txn = rows[0]
  if (!txn) return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 404 })
  if (txn.status === "completed") return NextResponse.json({ ok: true })
  if (!txn.gateway_order_id) {
    return NextResponse.json({ ok: false, error: "Order missing" }, { status: 400 })
  }

  let order: { order_id: string; order_status: string; order_amount: number; order_currency: string; cf_order_id?: number }
  try {
    order = await cashfreeFetch<typeof order>(`/pg/orders/${encodeURIComponent(txn.gateway_order_id)}`, { method: "GET" })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to fetch order" }, { status: 502 })
  }

  const expectedAmount = Math.abs(Number(txn.amount))
  if (Number(order.order_amount) !== expectedAmount || (order.order_currency || "INR") !== "INR") {
    return NextResponse.json({ ok: false, error: "Amount mismatch" }, { status: 400 })
  }

  const orderStatus = String(order.order_status || "").toUpperCase()
  if (orderStatus === "PAID") {
    await dbQuery(
      "UPDATE transactions SET status = 'completed', gateway_order_id = COALESCE(gateway_order_id, ?) WHERE id = ?",
      [txn.gateway_order_id, txn.id],
    )

    if (txn.type === "recharge" && txn.user_id) {
      await dbQuery("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [expectedAmount, txn.user_id])
    }

    return NextResponse.json({ ok: true, status: "completed" })
  }

  if (["CANCELLED", "EXPIRED", "TERMINATED", "FAILED"].includes(orderStatus)) {
    await dbQuery("UPDATE transactions SET status = 'failed' WHERE id = ?", [txn.id])
    return NextResponse.json({ ok: false, status: "failed", error: `Order ${orderStatus.toLowerCase()}` }, { status: 402 })
  }

  return NextResponse.json({ ok: false, status: "pending", error: "Payment pending" }, { status: 202 })
}

import { dbQuery } from "@/lib/server/db"
import { cashfreeFetch } from "@/lib/server/cashfree"
import { razorpayFetch } from "@/lib/server/razorpay"

export type DownloadTransactionRow = {
  id: string
  user_id: string | null
  type: "recharge" | "download"
  status: "pending" | "completed" | "failed"
  registration_number: string | null
  amount: string | number
  payment_method: "wallet" | "upi" | "razorpay" | "cashfree" | null
  gateway: string | null
  gateway_order_id: string | null
}

function normalizeGateway(txn: Pick<DownloadTransactionRow, "gateway" | "payment_method">) {
  const gateway = (txn.gateway || "").trim().toLowerCase()
  if (gateway === "cashfree" || gateway === "razorpay") return gateway
  const pm = (txn.payment_method || "").trim().toLowerCase()
  if (pm === "cashfree" || pm === "razorpay") return pm
  return null
}

export async function ensureDownloadTransactionCompleted(txn: DownloadTransactionRow): Promise<DownloadTransactionRow> {
  if (!txn || txn.type !== "download") return txn
  if (txn.status === "completed" || txn.status === "failed") return txn

  const gateway = normalizeGateway(txn)
  const gatewayOrderId = txn.gateway_order_id
  if (!gateway || !gatewayOrderId) return txn

  const expectedAmountRupees = Math.abs(Number(txn.amount))

  if (gateway === "cashfree") {
    const cashfreeEnabled = (process.env.PAYMENTS_ENABLE_CASHFREE ?? "").toLowerCase() === "true"
    if (!cashfreeEnabled) return txn

    let order: { order_status: string; order_amount: number | string; order_currency?: string }
    try {
      order = await cashfreeFetch<typeof order>(`/pg/orders/${encodeURIComponent(gatewayOrderId)}`, { method: "GET" })
    } catch {
      return txn
    }

    if (Number(order.order_amount) !== expectedAmountRupees || (order.order_currency || "INR") !== "INR") return txn

    const orderStatus = String(order.order_status || "").toUpperCase()
    if (orderStatus === "PAID") {
      await dbQuery("UPDATE transactions SET status = 'completed' WHERE id = ? AND status <> 'completed'", [txn.id])
      return { ...txn, status: "completed" }
    }

    if (["CANCELLED", "EXPIRED", "TERMINATED", "FAILED"].includes(orderStatus)) {
      await dbQuery("UPDATE transactions SET status = 'failed' WHERE id = ? AND status <> 'completed'", [txn.id])
      return { ...txn, status: "failed" }
    }

    return txn
  }

  if (gateway === "razorpay") {
    const razorpayEnabled = (process.env.PAYMENTS_ENABLE_RAZORPAY ?? "").toLowerCase() === "true"
    if (!razorpayEnabled) return txn

    let order: { amount: number; currency: string; status: string }
    try {
      order = await razorpayFetch<typeof order>(`/orders/${encodeURIComponent(gatewayOrderId)}`, { method: "GET" })
    } catch {
      return txn
    }

    const expectedAmountPaise = Math.round(expectedAmountRupees * 100)
    if (Number(order.amount) !== expectedAmountPaise || (order.currency || "INR") !== "INR") return txn

    const orderStatus = String(order.status || "").toLowerCase()
    if (orderStatus === "paid") {
      await dbQuery("UPDATE transactions SET status = 'completed' WHERE id = ? AND status <> 'completed'", [txn.id])
      return { ...txn, status: "completed" }
    }

    return txn
  }

  return txn
}


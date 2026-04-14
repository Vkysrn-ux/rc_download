import { NextResponse } from "next/server"
import { dbQuery } from "@/lib/server/db"

// Finvedex sends a POST webhook when payment status changes.
// Common payload fields (adjust field names if Finvedex uses different keys):
//   order_id, status, transaction_id, amount
export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  const contentType = req.headers.get("content-type") || ""

  try {
    if (contentType.includes("application/json")) {
      body = await req.json()
    } else {
      // form-urlencoded or multipart
      const text = await req.text()
      for (const pair of text.split("&")) {
        const [k, v] = pair.split("=").map(decodeURIComponent)
        if (k) body[k] = v ?? ""
      }
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 })
  }

  // Finvedex webhook payload: order_id, status ("SUCCESS"/"COMPLETED"/"FAILED"), txnStatus inside result
  const orderId = String(body?.order_id || body?.orderId || (body?.result as any)?.orderId || "")
  const rawStatus = String(
    body?.status ||
    (body?.result as any)?.status ||
    (body?.result as any)?.txnStatus ||
    body?.payment_status ||
    ""
  ).toUpperCase()
  const txnId = String(body?.transaction_id || body?.txn_id || body?.transactionId || (body?.result as any)?.txnId || "")

  console.log("[finvedex webhook] orderId:", orderId, "status:", rawStatus, "body:", JSON.stringify(body).slice(0, 300))

  if (!orderId) {
    return NextResponse.json({ ok: false, error: "Missing order_id" }, { status: 400 })
  }

  const isSuccess = rawStatus === "SUCCESS" || rawStatus === "COMPLETED" || rawStatus === "PAID"

  if (!isSuccess) {
    // Mark as failed if explicitly failed
    if (rawStatus === "FAILED" || rawStatus === "FAILURE" || rawStatus === "CANCELLED") {
      await dbQuery(
        "UPDATE transactions SET status = 'failed' WHERE gateway_order_id = ? AND status = 'pending'",
        [orderId],
      ).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  // Mark transaction as completed
  const txns = await dbQuery<{ id: string; status: string; type: string; user_id: string | null; amount: number }>(
    "SELECT id, status, type, user_id, amount FROM transactions WHERE gateway_order_id = ? LIMIT 1",
    [orderId],
  ).catch(() => [] as any[])

  const txn = (txns as any[])[0]
  if (!txn) return NextResponse.json({ ok: true }) // unknown order — ignore
  if (txn.status === "completed") return NextResponse.json({ ok: true }) // already done

  await dbQuery(
    "UPDATE transactions SET status = 'completed', payment_method = 'finvedex' WHERE id = ?",
    [txn.id],
  ).catch(() => {})

  // Credit wallet for recharge transactions
  if (txn.type === "recharge" && txn.user_id) {
    await dbQuery(
      "UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?",
      [Number(txn.amount), txn.user_id],
    ).catch(() => {})
  }

  console.log(`[finvedex webhook] approved txn ${txn.id} order ${orderId} gateway_txn ${txnId}`)

  return NextResponse.json({ ok: true })
}

// Finvedex may also call GET for verification — respond 200
export async function GET() {
  return NextResponse.json({ ok: true })
}

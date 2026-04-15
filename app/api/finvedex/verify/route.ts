import { NextResponse } from "next/server"
import { dbQuery } from "@/lib/server/db"
import { checkFinvedexOrderStatus, makeFinvedexOrderId } from "@/lib/server/finvedex"

async function creditWalletIfRecharge(txnId: string) {
  // Fetch full transaction details to check if it's a pending recharge
  const rows = await dbQuery<{ id: string; status: string; type: string; user_id: string | null; amount: string | number }>(
    "SELECT id, status, type, user_id, amount FROM transactions WHERE id = ? LIMIT 1",
    [txnId],
  ).catch(() => [] as any[])
  const txn = (rows as any[])[0]
  if (!txn) return

  // Mark as completed
  await dbQuery(
    "UPDATE transactions SET status = 'completed', payment_method = 'finvedex' WHERE id = ? AND status != 'completed'",
    [txn.id],
  ).catch(() => {})

  // Credit wallet for recharge — only if not already completed (status was pending)
  if (txn.type === "recharge" && txn.user_id && txn.status !== "completed") {
    const amount = Math.abs(Number(txn.amount))
    await dbQuery(
      "UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?",
      [amount, txn.user_id],
    ).catch(() => {})
    console.log(`[finvedex verify] credited wallet ₹${amount} for user ${txn.user_id} txn ${txn.id}`)
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const transactionId = url.searchParams.get("transactionId") || ""

  if (!transactionId) {
    return NextResponse.json({ ok: false, error: "Missing transactionId" }, { status: 400 })
  }

  // Check our DB first
  const txns = await dbQuery<{ id: string; status: string; type: string; user_id: string | null; amount: string | number }>(
    "SELECT id, status, type, user_id, amount FROM transactions WHERE id = ? LIMIT 1",
    [transactionId],
  ).catch(() => [] as any[])

  const txn = (txns as any[])[0]

  if (txn) {
    // If already completed, return immediately (wallet was credited by webhook or a prior verify call)
    if (txn.status === "completed") {
      return NextResponse.json({ ok: true, status: "completed" })
    }

    // If pending, double-check with Finvedex in case webhook hasn't arrived yet
    const orderId = makeFinvedexOrderId(transactionId)
    const finvedexStatus = await checkFinvedexOrderStatus(orderId)
    if (finvedexStatus === "completed") {
      // Update DB to completed and credit wallet if this is a recharge
      await creditWalletIfRecharge(transactionId)
      return NextResponse.json({ ok: true, status: "completed" })
    }
    return NextResponse.json({ ok: true, status: txn.status })
  }

  // Transaction not in DB (DB insert may have failed) — check Finvedex directly
  const orderId = makeFinvedexOrderId(transactionId)
  const finvedexStatus = await checkFinvedexOrderStatus(orderId)

  if (finvedexStatus === "completed") {
    // Payment succeeded even though we have no DB record — allow the user through
    console.log("[finvedex verify] payment confirmed via Finvedex API for missing txn", transactionId)
    return NextResponse.json({ ok: true, status: "completed" })
  }

  if (finvedexStatus === "failed") {
    return NextResponse.json({ ok: true, status: "failed" })
  }

  // Still pending or Finvedex unreachable — tell client to retry
  return NextResponse.json({ ok: true, status: "pending" })
}

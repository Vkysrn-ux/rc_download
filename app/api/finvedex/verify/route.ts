import { NextResponse } from "next/server"
import { dbQuery } from "@/lib/server/db"
import { checkFinvedexOrderStatus, makeFinvedexOrderId } from "@/lib/server/finvedex"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const transactionId = url.searchParams.get("transactionId") || ""

  if (!transactionId) {
    return NextResponse.json({ ok: false, error: "Missing transactionId" }, { status: 400 })
  }

  // Check our DB first
  const txns = await dbQuery<{ id: string; status: string }>(
    "SELECT id, status FROM transactions WHERE id = ? LIMIT 1",
    [transactionId],
  ).catch(() => [] as any[])

  const txn = (txns as any[])[0]

  if (txn) {
    // If already completed, return immediately
    if (txn.status === "completed") {
      return NextResponse.json({ ok: true, status: "completed" })
    }

    // If pending, double-check with Finvedex in case webhook hasn't arrived yet
    const orderId = makeFinvedexOrderId(transactionId)
    const finvedexStatus = await checkFinvedexOrderStatus(orderId)
    if (finvedexStatus === "completed") {
      // Update DB to completed
      await dbQuery(
        "UPDATE transactions SET status = 'completed' WHERE id = ?",
        [transactionId],
      ).catch(() => {})
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

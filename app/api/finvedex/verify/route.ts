import { NextResponse } from "next/server"
import { dbQuery } from "@/lib/server/db"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const transactionId = url.searchParams.get("transactionId") || ""

  if (!transactionId) {
    return NextResponse.json({ ok: false, error: "Missing transactionId" }, { status: 400 })
  }

  const txns = await dbQuery<{ id: string; status: string }>(
    "SELECT id, status FROM transactions WHERE id = ? LIMIT 1",
    [transactionId],
  ).catch(() => [] as any[])

  const txn = (txns as any[])[0]
  if (!txn) {
    return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, status: txn.status })
}

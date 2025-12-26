import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"

const ApproveSchema = z.object({ transactionId: z.string().min(10) })

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = ApproveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const transactionId = parsed.data.transactionId

  const txns = await dbQuery<{
    id: string
    user_id: string | null
    type: "recharge" | "download"
    amount: string | number
    status: "pending" | "completed" | "failed"
  }>("SELECT id, user_id, type, amount, status FROM transactions WHERE id = ? LIMIT 1", [transactionId])

  const txn = txns[0]
  if (!txn) return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 404 })
  if (txn.status === "completed") return NextResponse.json({ ok: true })

  await dbQuery("UPDATE transactions SET status = 'completed' WHERE id = ?", [transactionId])

  if (txn.type === "recharge" && txn.user_id) {
    await dbQuery("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [Number(txn.amount), txn.user_id])
  }

  return NextResponse.json({ ok: true })
}


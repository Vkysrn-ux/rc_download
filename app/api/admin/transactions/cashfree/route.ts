import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"
import { cashfreeFetch } from "@/lib/server/cashfree"

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const rows = await dbQuery<{
    id: string
    user_id: string | null
    user_email: string | null
    user_name: string | null
    type: "recharge" | "download"
    amount: string | number
    status: string
    payment_method: string | null
    description: string | null
    registration_number: string | null
    gateway_order_id: string | null
    created_at: string
  }>(
    `SELECT t.id, t.user_id, u.email AS user_email, u.name AS user_name, t.type, t.amount, t.status, t.payment_method, t.description, t.registration_number, t.gateway_order_id, t.created_at
     FROM transactions t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.gateway = 'cashfree'
     ORDER BY t.created_at DESC`,
  )

  const results: any[] = []

  for (const r of rows) {
    const orderId = r.gateway_order_id
    let remote: any = null
    if (orderId) {
      try {
        remote = await cashfreeFetch(`/pg/orders/${encodeURIComponent(orderId)}`, { method: "GET" })
      } catch (e: any) {
        remote = { error: e?.message || String(e) }
      }
    }

    const customerPhone = remote?.customer_details?.customer_phone || null
    const remoteStatusRaw = remote?.order_status || remote?.order?.order_status || remote?.order?.status || null
    const remoteStatus = remoteStatusRaw ? String(remoteStatusRaw).toUpperCase() : null

    // Normalize remote Cashfree statuses into our local statuses: completed | failed | pending
    let finalStatus = r.status || "pending"
    if (remoteStatus) {
      if (["PAID", "SUCCESS", "CAPTURED", "COMPLETED", "AUTHORISED"].some((s) => remoteStatus.includes(s))) {
        finalStatus = "completed"
      } else if (["CANCELLED", "EXPIRED", "TERMINATED", "FAILED", "DECLINED", "VOIDED"].some((s) => remoteStatus.includes(s))) {
        finalStatus = "failed"
      } else {
        finalStatus = "pending"
      }
    }

    results.push({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      type: r.type,
      amount: Number(r.amount),
      status: finalStatus,
      paymentMethod: r.payment_method,
      description: r.description,
      registrationNumber: r.registration_number,
      gatewayOrderId: r.gateway_order_id,
      remoteOrder: remote,
      customerPhone,
      timestamp: r.created_at,
    })
  }

  return NextResponse.json({ ok: true, transactions: results })
}

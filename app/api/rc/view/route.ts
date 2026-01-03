import { NextResponse } from "next/server"
import { lookupRc, storeRcResult, ExternalApiError } from "@/lib/server/rc-lookup"
import { dbQuery } from "@/lib/server/db"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const transactionId = url.searchParams.get("transactionId") || ""
  if (!transactionId) return NextResponse.json({ ok: false, error: "Missing transactionId" }, { status: 400 })

  const txns = await dbQuery<{
    id: string
    user_id: string | null
    type: "recharge" | "download"
    status: "pending" | "completed" | "failed"
    registration_number: string | null
  }>("SELECT id, user_id, type, status, registration_number FROM transactions WHERE id = ? LIMIT 1", [transactionId])

  const txn = txns[0]
  if (!txn || txn.type !== "download" || !txn.registration_number) {
    return NextResponse.json({ ok: false, error: "Invalid transaction" }, { status: 404 })
  }

  if (txn.status !== "completed") {
    return NextResponse.json({ ok: false, error: "Payment pending. RC will be available after confirmation." }, { status: 402 })
  }

  try {
    const result = await lookupRc(txn.registration_number, { userId: txn.user_id ?? null })
    if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    await storeRcResult(result.registrationNumber, txn.user_id ?? null, result.data, result.provider, result.providerRef).catch(() => {})
    return NextResponse.json({
      ok: true,
      registrationNumber: result.registrationNumber,
      data: result.data,
      provider: result.provider,
      providerRef: result.providerRef,
    })
  } catch (error: any) {
    if (error instanceof ExternalApiError) {
      const status =
        error.status === 404 ? 404 : error.status === 503 ? 503 : error.status === 401 || error.status === 403 ? 502 : 502
      return NextResponse.json({ ok: false, error: error.message }, { status })
    }
    return NextResponse.json({ ok: false, error: error?.message || "Lookup failed" }, { status: 500 })
  }
}

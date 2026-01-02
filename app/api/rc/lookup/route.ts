import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"
import { lookupRc, storeRcResult, ExternalApiError, normalizeRegistration } from "@/lib/server/rc-lookup"

const LookupSchema = z.object({ registrationNumber: z.string().min(4).max(32) })

const USER_PRICE = 20

async function hasPurchased(userId: string, registrationNumber: string) {
  const rows = await dbQuery<{ id: string }>(
    "SELECT id FROM transactions WHERE user_id = ? AND type = 'download' AND status = 'completed' AND registration_number = ? LIMIT 1",
    [userId, registrationNumber],
  )
  return Boolean(rows[0]?.id)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const reg = url.searchParams.get("registrationNumber")
  if (!reg) return NextResponse.json({ ok: false, error: "Missing registrationNumber" }, { status: 400 })

  try {
    const registrationNumber = normalizeRegistration(reg)
    const user = await getCurrentUser().catch(() => null)
    if (user) {
      const balances = await dbQuery<{ wallet_balance: string | number }>(
        "SELECT wallet_balance FROM users WHERE id = ? LIMIT 1",
        [user.id],
      )
      const walletBalance = Number(balances[0]?.wallet_balance ?? 0)
      if (walletBalance < USER_PRICE && !(await hasPurchased(user.id, registrationNumber))) {
        return NextResponse.json({ ok: false, error: "Insufficient wallet balance. Please pay to view RC." }, { status: 402 })
      }
    }

    const result = await lookupRc(registrationNumber, { userId: user?.id ?? null })
    if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    await storeRcResult(result.registrationNumber, user?.id ?? null, result.data, result.provider, result.providerRef).catch(() => {})

    return NextResponse.json({
      ok: true,
      registrationNumber: result.registrationNumber,
      data: result.data,
      provider: result.provider,
      providerRef: result.providerRef,
    })
  } catch (error: any) {
    if (error instanceof ExternalApiError) {
      const status = error.status === 404 ? 404 : error.status === 401 || error.status === 403 ? 502 : 502
      return NextResponse.json({ ok: false, error: error.message }, { status })
    }
    return NextResponse.json({ ok: false, error: error?.message || "Lookup failed" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = LookupSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  try {
    const registrationNumber = normalizeRegistration(parsed.data.registrationNumber)
    const user = await getCurrentUser().catch(() => null)
    if (user) {
      const balances = await dbQuery<{ wallet_balance: string | number }>(
        "SELECT wallet_balance FROM users WHERE id = ? LIMIT 1",
        [user.id],
      )
      const walletBalance = Number(balances[0]?.wallet_balance ?? 0)
      if (walletBalance < USER_PRICE && !(await hasPurchased(user.id, registrationNumber))) {
        return NextResponse.json({ ok: false, error: "Insufficient wallet balance. Please pay to view RC." }, { status: 402 })
      }
    }

    const result = await lookupRc(registrationNumber, { userId: user?.id ?? null })
    if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    await storeRcResult(result.registrationNumber, user?.id ?? null, result.data, result.provider, result.providerRef).catch(() => {})

    return NextResponse.json({
      ok: true,
      registrationNumber: result.registrationNumber,
      data: result.data,
      provider: result.provider,
      providerRef: result.providerRef,
    })
  } catch (error: any) {
    if (error instanceof ExternalApiError) {
      const status = error.status === 404 ? 404 : error.status === 401 || error.status === 403 ? 502 : 502
      return NextResponse.json({ ok: false, error: error.message }, { status })
    }
    return NextResponse.json({ ok: false, error: error?.message || "Lookup failed" }, { status: 500 })
  }
}

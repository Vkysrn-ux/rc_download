import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"
import { lookupRc, storeRcResult, ExternalApiError, normalizeRegistration } from "@/lib/server/rc-lookup"
import { WalletError, chargeWalletForDownload } from "@/lib/server/wallet"
import { REGISTERED_RC_DOWNLOAD_PRICE_INR } from "@/lib/pricing"

const LookupSchema = z.object({ registrationNumber: z.string().min(4).max(32) })

export async function GET(req: Request) {
  const url = new URL(req.url)
  const reg = url.searchParams.get("registrationNumber")
  if (!reg) return NextResponse.json({ ok: false, error: "Missing registrationNumber" }, { status: 400 })
  const freshParam = (url.searchParams.get("fresh") || "").trim().toLowerCase()
  const bypassCache = freshParam === "1" || freshParam === "true" || freshParam === "yes"

  try {
    const registrationNumber = normalizeRegistration(reg)
    const user = await getCurrentUser().catch(() => null)
    if (!user) {
      return NextResponse.json({ ok: false, error: "Payment required to view RC." }, { status: 402 })
    }

    const balances = await dbQuery<{ wallet_balance: string | number }>(
      "SELECT wallet_balance FROM users WHERE id = ? LIMIT 1",
      [user.id],
    )
    const walletBalance = Number(balances[0]?.wallet_balance ?? 0)
    if (walletBalance < REGISTERED_RC_DOWNLOAD_PRICE_INR) {
      return NextResponse.json({ ok: false, error: "Insufficient wallet balance. Please recharge wallet." }, { status: 402 })
    }

    const result = await lookupRc(registrationNumber, { userId: user?.id ?? null, bypassCache })
    if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    await storeRcResult(result.registrationNumber, user?.id ?? null, result.data, result.provider, result.providerRef).catch(() => {})

    const charged = await chargeWalletForDownload({
      userId: user.id,
      registrationNumber: result.registrationNumber,
      price: REGISTERED_RC_DOWNLOAD_PRICE_INR,
      description: `Vehicle RC Download - ${result.registrationNumber}`,
    })

    return NextResponse.json({
      ok: true,
      registrationNumber: result.registrationNumber,
      transactionId: charged.transactionId,
      walletCharged: true,
      walletBalance: charged.walletBalance,
      data: result.data,
      provider: result.provider,
    })
  } catch (error: any) {
    if (error instanceof WalletError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }
    if (error instanceof ExternalApiError) {
      const status =
        error.status === 404 ? 404 : error.status === 503 ? 503 : error.status === 401 || error.status === 403 ? 502 : 502
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
    if (!user) {
      return NextResponse.json({ ok: false, error: "Payment required to view RC." }, { status: 402 })
    }

    const balances = await dbQuery<{ wallet_balance: string | number }>(
      "SELECT wallet_balance FROM users WHERE id = ? LIMIT 1",
      [user.id],
    )
    const walletBalance = Number(balances[0]?.wallet_balance ?? 0)
    if (walletBalance < REGISTERED_RC_DOWNLOAD_PRICE_INR) {
      return NextResponse.json({ ok: false, error: "Insufficient wallet balance. Please recharge wallet." }, { status: 402 })
    }

    const result = await lookupRc(registrationNumber, { userId: user?.id ?? null })
    if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    await storeRcResult(result.registrationNumber, user?.id ?? null, result.data, result.provider, result.providerRef).catch(() => {})

    const charged = await chargeWalletForDownload({
      userId: user.id,
      registrationNumber: result.registrationNumber,
      price: REGISTERED_RC_DOWNLOAD_PRICE_INR,
      description: `Vehicle RC Download - ${result.registrationNumber}`,
    })

    return NextResponse.json({
      ok: true,
      registrationNumber: result.registrationNumber,
      transactionId: charged.transactionId,
      walletCharged: true,
      walletBalance: charged.walletBalance,
      data: result.data,
      provider: result.provider,
    })
  } catch (error: any) {
    if (error instanceof WalletError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }
    if (error instanceof ExternalApiError) {
      const status =
        error.status === 404 ? 404 : error.status === 503 ? 503 : error.status === 401 || error.status === 403 ? 502 : 502
      return NextResponse.json({ ok: false, error: error.message }, { status })
    }
    return NextResponse.json({ ok: false, error: error?.message || "Lookup failed" }, { status: 500 })
  }
}

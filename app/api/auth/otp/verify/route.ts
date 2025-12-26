import { NextResponse } from "next/server"
import { z } from "zod"
import { dbQuery } from "@/lib/server/db"
import { sha256Hex } from "@/lib/server/security"
import { setSessionCookie } from "@/lib/server/session"

const VerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
})

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = VerifySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

    const email = parsed.data.email.toLowerCase().trim()
    const otp = parsed.data.otp

    const users = await dbQuery<{
      id: string
      email: string
      name: string
      role: "user" | "admin"
      wallet_balance: string | number
      email_verified_at: string | null
      is_active: number
    }>(
      "SELECT id, email, name, role, wallet_balance, email_verified_at, is_active FROM users WHERE email = ? LIMIT 1",
      [email],
    )

    const user = users[0]
    if (!user || !user.is_active) return NextResponse.json({ ok: false, error: "Invalid OTP" }, { status: 401 })
    if (!user.email_verified_at) return NextResponse.json({ ok: false, error: "Email not verified" }, { status: 403 })

    const codeHash = sha256Hex(otp)

    const otps = await dbQuery<{ id: string; expires_at: string; used_at: string | null }>(
      "SELECT id, expires_at, used_at FROM otp_codes WHERE user_id = ? AND code_hash = ? ORDER BY created_at DESC LIMIT 1",
      [user.id, codeHash],
    )

    const otpRow = otps[0]
    if (!otpRow || otpRow.used_at) return NextResponse.json({ ok: false, error: "Invalid OTP" }, { status: 401 })

    const expiresAt = new Date(otpRow.expires_at)
    if (Date.now() > expiresAt.getTime())
      return NextResponse.json({ ok: false, error: "OTP expired" }, { status: 401 })

    await dbQuery("UPDATE otp_codes SET used_at = NOW() WHERE id = ?", [otpRow.id])

    await setSessionCookie(user.id)
    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletBalance: Number(user.wallet_balance),
        role: user.role,
      },
    })
  } catch (error: any) {
    const message = error?.message || "OTP verification failed"
    if (typeof message === "string" && message.includes("AUTH_JWT_SECRET")) {
      return NextResponse.json(
        { ok: false, error: "Server misconfigured: missing AUTH_JWT_SECRET in .env.local" },
        { status: 500 },
      )
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

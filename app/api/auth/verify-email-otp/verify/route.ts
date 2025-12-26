import { NextResponse } from "next/server"
import { z } from "zod"
import { dbQuery } from "@/lib/server/db"
import { sha256Hex } from "@/lib/server/security"

const VerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = VerifySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const email = parsed.data.email.toLowerCase().trim()
  const codeHash = sha256Hex(parsed.data.otp)

  const users = await dbQuery<{ id: string; email_verified_at: string | null; is_active: number }>(
    "SELECT id, email_verified_at, is_active FROM users WHERE email = ? LIMIT 1",
    [email],
  )

  const user = users[0]
  if (!user || !user.is_active) return NextResponse.json({ ok: false, error: "Invalid OTP" }, { status: 401 })
  if (user.email_verified_at) return NextResponse.json({ ok: true })

  const rows = await dbQuery<{ id: string; expires_at: string; used_at: string | null }>(
    "SELECT id, expires_at, used_at FROM email_verification_otps WHERE user_id = ? AND code_hash = ? ORDER BY created_at DESC LIMIT 1",
    [user.id, codeHash],
  )

  const otpRow = rows[0]
  if (!otpRow || otpRow.used_at) return NextResponse.json({ ok: false, error: "Invalid OTP" }, { status: 401 })

  const expiresAt = new Date(otpRow.expires_at)
  if (Date.now() > expiresAt.getTime()) return NextResponse.json({ ok: false, error: "OTP expired" }, { status: 401 })

  await dbQuery("UPDATE email_verification_otps SET used_at = NOW() WHERE id = ?", [otpRow.id])
  await dbQuery("UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?", [user.id])

  return NextResponse.json({ ok: true })
}


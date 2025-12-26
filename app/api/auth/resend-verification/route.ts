import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"
import { randomOtp6, sha256Hex } from "@/lib/server/security"
import { isSmtpConfigured, sendEmailVerificationOtp } from "@/lib/server/email"

const ResendSchema = z.object({ email: z.string().email() })

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = ResendSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const email = parsed.data.email.toLowerCase().trim()

  const users = await dbQuery<{ id: string; email_verified_at: string | null; is_active: number }>(
    "SELECT id, email_verified_at, is_active FROM users WHERE email = ? LIMIT 1",
    [email],
  )

  const user = users[0]
  if (!user || !user.is_active) return NextResponse.json({ ok: true })
  if (user.email_verified_at) return NextResponse.json({ ok: true })

  const otp = randomOtp6()
  const codeHash = sha256Hex(otp)
  const otpId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await dbQuery("INSERT INTO email_verification_otps (id, user_id, code_hash, expires_at) VALUES (?, ?, ?, ?)", [
    otpId,
    user.id,
    codeHash,
    expiresAt,
  ])

  await sendEmailVerificationOtp(email, otp)

  const debugOtp = !isSmtpConfigured() && process.env.NODE_ENV !== "production" ? otp : undefined
  return NextResponse.json({ ok: true, ...(debugOtp ? { debugOtp } : {}) })
}

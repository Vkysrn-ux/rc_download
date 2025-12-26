import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"
import { randomOtp6, sha256Hex } from "@/lib/server/security"
import { isSmtpConfigured, sendEmailVerificationOtp } from "@/lib/server/email"

const SignupSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(6).max(200),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = SignupSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const email = parsed.data.email.toLowerCase().trim()
  const name = parsed.data.name.trim()
  const password = parsed.data.password

  const existing = await dbQuery<{ id: string }>("SELECT id FROM users WHERE email = ? LIMIT 1", [email])
  if (existing[0]) return NextResponse.json({ ok: false, error: "Email already exists" }, { status: 409 })

  const userId = crypto.randomUUID()
  const passwordHash = await bcrypt.hash(password, 12)

  await dbQuery(
    "INSERT INTO users (id, email, name, password_hash, role, wallet_balance) VALUES (?, ?, ?, ?, 'user', 0)",
    [userId, email, name, passwordHash],
  )

  const otp = randomOtp6()
  const codeHash = sha256Hex(otp)
  const otpId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await dbQuery("INSERT INTO email_verification_otps (id, user_id, code_hash, expires_at) VALUES (?, ?, ?, ?)", [
    otpId,
    userId,
    codeHash,
    expiresAt,
  ])

  await sendEmailVerificationOtp(email, otp)

  const debugOtp = !isSmtpConfigured() && process.env.NODE_ENV !== "production" ? otp : undefined
  return NextResponse.json({ ok: true, requiresVerification: true, verificationMethod: "otp", ...(debugOtp ? { debugOtp } : {}) })
}

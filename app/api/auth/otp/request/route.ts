import { NextResponse } from "next/server"
import { z } from "zod"
import { dbQuery } from "@/lib/server/db"
import { randomOtp6, sha256Hex } from "@/lib/server/security"
import { isSmtpConfigured, sendOtpEmail } from "@/lib/server/email"
import crypto from "crypto"

const RequestSchema = z.object({ email: z.string().email() })

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const email = parsed.data.email.toLowerCase().trim()

  try {
    const users = await dbQuery<{ id: string; email_verified_at: string | null; is_active: number }>(
      "SELECT id, email_verified_at, is_active FROM users WHERE email = ? LIMIT 1",
      [email],
    )
    const user = users[0]

    // Always return ok (avoid account enumeration), but only send if eligible.
    if (!user || !user.is_active) return NextResponse.json({ ok: true })
    if (!user.email_verified_at) {
      return NextResponse.json({ ok: false, error: "Email not verified. Please verify first." }, { status: 403 })
    }

    const otp = randomOtp6()
    const codeHash = sha256Hex(otp)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    const id = crypto.randomUUID()

    await dbQuery("INSERT INTO otp_codes (id, user_id, code_hash, expires_at) VALUES (?, ?, ?, ?)", [
      id,
      user.id,
      codeHash,
      expiresAt,
    ])

    await sendOtpEmail(email, otp)
    const debugOtp = !isSmtpConfigured() && process.env.NODE_ENV !== "production" ? otp : undefined
    return NextResponse.json({ ok: true, ...(debugOtp ? { debugOtp } : {}) })
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to generate OTP. Check DB connection." }, { status: 500 })
  }
}

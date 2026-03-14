import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"
import { randomOtp6, sha256Hex } from "@/lib/server/security"
import { isSmtpConfigured, sendPasswordResetOtp } from "@/lib/server/email"
import { sendWhatsAppOtp } from "@/lib/server/whatsapp"

const RequestSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
})

function getPhoneCandidates(input: string): string[] {
  const trimmed = input.trim()
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return []
  const candidates = [trimmed, digits, `+${digits}`]
  return Array.from(new Set(candidates.filter(Boolean)))
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const identifier = parsed.data.identifier.trim()
  const emailParsed = z.string().email().safeParse(identifier)

  try {
    let users: { id: string; email: string; phone: string | null; is_active: number }[] = []
    try {
      if (emailParsed.success) {
        const email = emailParsed.data.toLowerCase().trim()
        users = await dbQuery<{ id: string; email: string; phone: string | null; is_active: number }>(
          "SELECT id, email, phone, is_active FROM users WHERE email = ? LIMIT 1",
          [email],
        )
      } else {
        const candidates = getPhoneCandidates(identifier)
        if (candidates.length > 0) {
          const padded = [...candidates, "__no_match__", "__no_match__", "__no_match__"].slice(0, 3)
          users = await dbQuery<{ id: string; email: string; phone: string | null; is_active: number }>(
            "SELECT id, email, phone, is_active FROM users WHERE phone = ? OR phone = ? OR phone = ? LIMIT 1",
            padded,
          )
        }
      }
    } catch (error: any) {
      const msg = typeof error?.message === "string" ? error.message : ""
      if (error?.code === "ER_BAD_FIELD_ERROR" && msg.toLowerCase().includes("phone")) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Database schema is outdated (missing users.phone). Apply `db/migrations/001_add_users_phone.sql` to your existing DB.",
          },
          { status: 500 },
        )
      }
      throw error
    }

    const user = users[0]

    // Avoid account enumeration: always return ok.
    if (!user || !user.is_active) return NextResponse.json({ ok: true })

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

    // Send OTP via all available channels in parallel
    const emailSent = await sendPasswordResetOtp(user.email, otp)
    const whatsappSent = user.phone ? await sendWhatsAppOtp(user.phone, otp) : false

    // If both channels failed, tell the user so they can troubleshoot
    if (!emailSent && !whatsappSent) {
      console.error("[password-reset] Both email and WhatsApp delivery failed for user", user.id)
      const debugOtp = process.env.NODE_ENV !== "production" ? otp : undefined
      return NextResponse.json({
        ok: false,
        error: "Unable to deliver OTP. Please check your email/phone settings or contact support.",
        ...(debugOtp ? { debugOtp } : {}),
      }, { status: 502 })
    }

    // Tell the client which channels succeeded so UI can inform the user
    const channels: string[] = []
    if (emailSent) channels.push("email")
    if (whatsappSent) channels.push("whatsapp")

    return NextResponse.json({ ok: true, channels })
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to send reset code. Check DB connection." }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { dbQuery } from "@/lib/server/db"
import { sha256Hex } from "@/lib/server/security"

const ConfirmSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
  otp: z.string().regex(/^\\d{6}$/),
  password: z.string().min(6).max(200),
})

function getPhoneCandidates(input: string): string[] {
  const trimmed = input.trim()
  const digits = trimmed.replace(/\\D/g, "")
  if (digits.length < 8 || digits.length > 15) return []
  const candidates = [trimmed, digits, `+${digits}`]
  return Array.from(new Set(candidates.filter(Boolean)))
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = ConfirmSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const identifier = parsed.data.identifier.trim()
  const otp = parsed.data.otp
  const password = parsed.data.password
  const emailParsed = z.string().email().safeParse(identifier)

  let users: { id: string; is_active: number }[] = []
  try {
    if (emailParsed.success) {
      const email = emailParsed.data.toLowerCase().trim()
      users = await dbQuery<{ id: string; is_active: number }>("SELECT id, is_active FROM users WHERE email = ? LIMIT 1", [email])
    } else {
      const candidates = getPhoneCandidates(identifier)
      if (candidates.length > 0) {
        const padded = [...candidates, "__no_match__", "__no_match__", "__no_match__"].slice(0, 3)
        users = await dbQuery<{ id: string; is_active: number }>(
          "SELECT id, is_active FROM users WHERE phone = ? OR phone = ? OR phone = ? LIMIT 1",
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
  if (!user || !user.is_active) return NextResponse.json({ ok: false, error: "Invalid OTP" }, { status: 401 })

  const codeHash = sha256Hex(otp)
  const rows = await dbQuery<{ id: string; expires_at: string; used_at: string | null }>(
    "SELECT id, expires_at, used_at FROM otp_codes WHERE user_id = ? AND code_hash = ? ORDER BY created_at DESC LIMIT 1",
    [user.id, codeHash],
  )

  const otpRow = rows[0]
  if (!otpRow || otpRow.used_at) return NextResponse.json({ ok: false, error: "Invalid OTP" }, { status: 401 })

  const expiresAt = new Date(otpRow.expires_at)
  if (Date.now() > expiresAt.getTime()) return NextResponse.json({ ok: false, error: "OTP expired" }, { status: 401 })

  const passwordHash = await bcrypt.hash(password, 12)
  await dbQuery("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, user.id])
  await dbQuery("UPDATE otp_codes SET used_at = NOW() WHERE id = ?", [otpRow.id])

  return NextResponse.json({ ok: true })
}

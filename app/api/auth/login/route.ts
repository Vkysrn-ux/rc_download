import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { dbQuery } from "@/lib/server/db"
import { setSessionCookie } from "@/lib/server/session"

const LoginSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
  password: z.string().min(1),
})

function getPhoneCandidates(input: string): string[] {
  const trimmed = input.trim()
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return []
  const candidates = [trimmed, digits, `+${digits}`]
  if (digits.length === 10) candidates.push(`+91${digits}`)
  return Array.from(new Set(candidates.filter(Boolean)))
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

    const identifier = parsed.data.identifier.trim()
    const password = parsed.data.password

    const emailParsed = z.string().email().safeParse(identifier)

    type UserRow = {
      id: string
      email: string
      phone: string | null
      name: string
      password_hash: string
      role: "user" | "admin"
      wallet_balance: string | number
      email_verified_at: string | null
      is_active: number
    }

    let users: UserRow[] = []
    try {
      if (emailParsed.success) {
        const email = emailParsed.data.toLowerCase().trim()
        users = await dbQuery<UserRow>(
          "SELECT id, email, phone, name, password_hash, role, wallet_balance, email_verified_at, is_active FROM users WHERE email = ? LIMIT 1",
          [email],
        )
      } else {
        const candidates = getPhoneCandidates(identifier)
        if (candidates.length > 0) {
          const padded = [...candidates, "__no_match__", "__no_match__", "__no_match__"].slice(0, 3)
          users = await dbQuery<UserRow>(
            "SELECT id, email, phone, name, password_hash, role, wallet_balance, email_verified_at, is_active FROM users WHERE phone = ? OR phone = ? OR phone = ? LIMIT 1",
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
    if (!user || !user.is_active) {
      return NextResponse.json({ ok: false, error: "Invalid email/mobile or password" }, { status: 401 })
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Invalid email/mobile or password" }, { status: 401 })
    }

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
    const message = error?.message || "Login failed"
    if (typeof message === "string" && message.includes("AUTH_JWT_SECRET")) {
      return NextResponse.json(
        { ok: false, error: "Server misconfigured: missing AUTH_JWT_SECRET in .env.local" },
        { status: 500 },
      )
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

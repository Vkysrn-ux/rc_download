import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"

const SignupSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().email(),
  phone: z.string().trim().min(1).max(32),
  password: z.string().min(6).max(200),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = SignupSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  try {
    const email = parsed.data.email.toLowerCase().trim()
    const name = parsed.data.name.trim()
    const phoneRaw = parsed.data.phone.trim()
    const password = parsed.data.password

    const existing = await dbQuery<{ id: string }>("SELECT id FROM users WHERE email = ? LIMIT 1", [email])
    if (existing[0]) return NextResponse.json({ ok: false, error: "Email already exists" }, { status: 409 })

    const phoneDigits = phoneRaw.replace(/\D/g, "")
    if (!phoneRaw.startsWith("+") || phoneDigits.length < 8 || phoneDigits.length > 15) {
      return NextResponse.json(
        { ok: false, error: "Invalid mobile number. Use country code (e.g. +9198...)" },
        { status: 400 },
      )
    }
    const phone = `+${phoneDigits}`

    const existingPhone = await dbQuery<{ id: string }>("SELECT id FROM users WHERE phone = ? LIMIT 1", [phone])
    if (existingPhone[0]) return NextResponse.json({ ok: false, error: "Mobile number already exists" }, { status: 409 })

    const userId = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(password, 12)

    await dbQuery(
      "INSERT INTO users (id, email, phone, name, password_hash, role, wallet_balance, email_verified_at) VALUES (?, ?, ?, ?, ?, 'user', 0, NOW())",
      [userId, email, phone, name, passwordHash],
    )

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : ""
    if (error?.code === "ER_BAD_FIELD_ERROR" && msg.toLowerCase().includes("phone")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Database schema is outdated (missing users.phone). Run `db/schema.sql` on a fresh DB or apply `db/migrations/001_add_users_phone.sql` to your existing DB.",
        },
        { status: 500 },
      )
    }
    throw error
  }
}

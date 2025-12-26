import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { dbQuery } from "@/lib/server/db"
import { setSessionCookie } from "@/lib/server/session"

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

    const email = parsed.data.email.toLowerCase().trim()
    const password = parsed.data.password

    const users = await dbQuery<{
      id: string
      email: string
      name: string
      password_hash: string
      role: "user" | "admin"
      wallet_balance: string | number
      email_verified_at: string | null
      is_active: number
    }>(
      "SELECT id, email, name, password_hash, role, wallet_balance, email_verified_at, is_active FROM users WHERE email = ? LIMIT 1",
      [email],
    )

    const user = users[0]
    if (!user || !user.is_active) {
      return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 })
    }

    if (!user.email_verified_at) {
      return NextResponse.json({ ok: false, error: "Email not verified" }, { status: 403 })
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 })
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

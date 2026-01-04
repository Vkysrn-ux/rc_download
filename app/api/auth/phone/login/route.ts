import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { dbQuery } from "@/lib/server/db"
import { setSessionCookie } from "@/lib/server/session"
import { getFirebaseAdminAuth } from "@/lib/server/firebase-admin"

export const runtime = "nodejs"

const PhoneLoginSchema = z.object({
  idToken: z.string().min(10),
  name: z.string().trim().min(1).max(255).optional(),
})

function placeholderEmailForPhone(phoneE164: string, userId: string) {
  const digits = phoneE164.replace(/\D/g, "")
  return `phone_${digits}_${userId.slice(0, 8)}@phone.local`
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = PhoneLoginSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

    const { idToken, name } = parsed.data
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken)
    const phone = decoded.phone_number
    if (!phone) return NextResponse.json({ ok: false, error: "Phone number missing in token" }, { status: 400 })

    const users = await dbQuery<{
      id: string
      email: string
      name: string
      role: "user" | "admin"
      wallet_balance: string | number
      is_active: number
    }>("SELECT id, email, name, role, wallet_balance, is_active FROM users WHERE phone = ? LIMIT 1", [phone])

    const existing = users[0]
    if (existing) {
      if (!existing.is_active) return NextResponse.json({ ok: false, error: "Account disabled" }, { status: 403 })
      await dbQuery("UPDATE users SET phone_verified_at = COALESCE(phone_verified_at, NOW()) WHERE id = ?", [existing.id])
      await setSessionCookie(existing.id)
      return NextResponse.json({
        ok: true,
        user: {
          id: existing.id,
          email: existing.email,
          name: existing.name,
          walletBalance: Number(existing.wallet_balance),
          role: existing.role,
        },
      })
    }

    const userId = crypto.randomUUID()
    const email = placeholderEmailForPhone(phone, userId)
    const displayName = name?.trim() || `User ${phone.replace(/\D/g, "").slice(-4) || "New"}`
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12)

    await dbQuery(
      "INSERT INTO users (id, email, name, password_hash, role, wallet_balance, phone, phone_verified_at) VALUES (?, ?, ?, ?, 'user', 0, ?, NOW())",
      [userId, email, displayName, passwordHash, phone],
    )

    await setSessionCookie(userId)
    return NextResponse.json({
      ok: true,
      user: { id: userId, email, name: displayName, walletBalance: 0, role: "user" as const },
    })
  } catch (error: any) {
    const message = error?.message || "Phone login failed"
    if (typeof message === "string" && message.includes("FIREBASE_")) {
      return NextResponse.json(
        { ok: false, error: "Server misconfigured: missing Firebase Admin env vars (see .env.example)" },
        { status: 500 },
      )
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}


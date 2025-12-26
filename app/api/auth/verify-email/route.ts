import { NextResponse } from "next/server"
import { z } from "zod"
import { dbQuery } from "@/lib/server/db"
import { sha256Hex } from "@/lib/server/security"

const VerifySchema = z.object({ token: z.string().min(10) })

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = VerifySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  const tokenHash = sha256Hex(parsed.data.token)

  const rows = await dbQuery<{
    id: string
    user_id: string
    expires_at: string
    used_at: string | null
  }>("SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE token_hash = ? LIMIT 1", [tokenHash])

  const row = rows[0]
  if (!row) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 400 })
  if (row.used_at) return NextResponse.json({ ok: false, error: "Token already used" }, { status: 400 })

  const expiresAt = new Date(row.expires_at)
  if (Date.now() > expiresAt.getTime()) return NextResponse.json({ ok: false, error: "Token expired" }, { status: 400 })

  await dbQuery("UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?", [row.id])
  await dbQuery("UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?", [row.user_id])

  return NextResponse.json({ ok: true })
}


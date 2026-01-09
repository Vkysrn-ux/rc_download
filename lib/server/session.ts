import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import { dbQuery } from "@/lib/server/db"

const COOKIE_NAME = "rc_app_session"
const SESSION_DAYS = 30

type SessionPayload = {
  sub: string
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function signSession(userId: string): string {
  const secret = required("AUTH_JWT_SECRET")
  return jwt.sign({ sub: userId } satisfies SessionPayload, secret, { expiresIn: `${SESSION_DAYS}d` })
}

function verifySession(token: string): SessionPayload | null {
  try {
    const secret = required("AUTH_JWT_SECRET")
    return jwt.verify(token, secret) as SessionPayload
  } catch {
    return null
  }
}

export async function setSessionCookie(userId: string) {
  const token = signSession(userId)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}

export type PublicUser = {
  id: string
  email: string
  phone: string | null
  name: string
  walletBalance: number
  role: "user" | "admin"
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  const payload = verifySession(token)
  if (!payload?.sub) return null

  let users: Array<{
    id: string
    email: string
    phone: string | null
    name: string
    wallet_balance: string | number
    role: "user" | "admin"
    is_active: number
  }> = []
  try {
    users = await dbQuery(
      "SELECT id, email, phone, name, wallet_balance, role, is_active FROM users WHERE id = ? LIMIT 1",
      [payload.sub],
    )
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : ""
    if (error?.code === "ER_BAD_FIELD_ERROR" && msg.toLowerCase().includes("phone")) {
      users = await dbQuery(
        "SELECT id, email, name, wallet_balance, role, is_active FROM users WHERE id = ? LIMIT 1",
        [payload.sub],
      )
    } else {
      throw error
    }
  }

  const user = users[0]
  if (!user) return null
  if (!user.is_active) return null

  return {
    id: user.id,
    email: user.email,
    phone: "phone" in user ? user.phone : null,
    name: user.name,
    walletBalance: Number(user.wallet_balance),
    role: user.role,
  }
}

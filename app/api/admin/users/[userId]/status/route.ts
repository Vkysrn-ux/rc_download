import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/server/session"
import { dbQuery } from "@/lib/server/db"

const StatusSchema = z.object({ isActive: z.boolean() })

export async function PATCH(req: Request, ctx: { params: { userId: string } }) {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const { userId } = ctx.params
  if (!userId) return NextResponse.json({ ok: false, error: "Invalid user" }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = StatusSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 })

  await dbQuery("UPDATE users SET is_active = ? WHERE id = ? AND role = 'user'", [parsed.data.isActive ? 1 : 0, userId])

  return NextResponse.json({ ok: true })
}

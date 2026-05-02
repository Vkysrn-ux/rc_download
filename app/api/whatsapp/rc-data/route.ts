import { NextResponse } from "next/server"
import { getRenderData } from "@/lib/server/whatsapp/render-store"

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")
  if (!token) return NextResponse.json({ ok: false }, { status: 400 })
  const data = getRenderData(token)
  if (!data) return NextResponse.json({ ok: false, error: "Token expired or invalid" }, { status: 404 })
  return NextResponse.json({ ok: true, data })
}

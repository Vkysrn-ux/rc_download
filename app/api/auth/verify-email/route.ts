import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ ok: false, error: "Email verification has been disabled." }, { status: 410 })
}

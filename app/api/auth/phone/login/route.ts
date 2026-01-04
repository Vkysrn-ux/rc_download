import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ ok: false, error: "Phone OTP login has been disabled." }, { status: 410 })
}

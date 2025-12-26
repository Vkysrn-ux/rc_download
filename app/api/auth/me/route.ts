import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/server/session"

export async function GET() {
  try {
    const user = await getCurrentUser()
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ user: null })
  }
}

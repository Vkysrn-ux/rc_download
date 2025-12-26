import { NextResponse } from "next/server"
import { dbQuery } from "@/lib/server/db"

export async function GET() {
  try {
    await dbQuery("SELECT 1 AS ok")
    return NextResponse.json({ ok: true, db: "connected" })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, db: "error", message: error?.message ?? "Unknown error" },
      { status: 500 },
    )
  }
}


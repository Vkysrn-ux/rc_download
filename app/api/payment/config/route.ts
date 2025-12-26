import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    upiId: process.env.PAYMENT_UPI_ID ?? "",
    payeeName: process.env.PAYMENT_PAYEE_NAME ?? "",
    qrUrl: process.env.PAYMENT_QR_URL ?? "",
    autoApprove: (process.env.PAYMENT_AUTO_APPROVE ?? "").toLowerCase() === "true",
  })
}


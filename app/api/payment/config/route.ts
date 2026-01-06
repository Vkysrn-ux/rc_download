import { NextResponse } from "next/server"

export async function GET() {
  const enableRazorpay = (process.env.PAYMENTS_ENABLE_RAZORPAY ?? "").toLowerCase() === "true"
  const enableManualUpi = (process.env.PAYMENTS_ENABLE_MANUAL_UPI ?? "").toLowerCase() === "true"
  const enableCashfree = (process.env.PAYMENTS_ENABLE_CASHFREE ?? "").toLowerCase() === "true"
  const cashfreeMode = (process.env.CASHFREE_ENV ?? "").toLowerCase() === "production" ? "production" : "sandbox"

  return NextResponse.json({
    upiId: process.env.PAYMENT_UPI_ID ?? "",
    payeeName: process.env.PAYMENT_PAYEE_NAME ?? "",
    qrUrl: process.env.PAYMENT_QR_URL ?? "",
    autoApprove: (process.env.PAYMENT_AUTO_APPROVE ?? "").toLowerCase() === "true",
    enableRazorpay,
    enableManualUpi,
    enableCashfree,
    cashfreeMode,
  })
}


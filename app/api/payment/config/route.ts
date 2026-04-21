import { NextResponse } from "next/server"

export async function GET() {
  const enableFinvedex = (process.env.PAYMENTS_ENABLE_FINVEDEX ?? "").toLowerCase() === "true"

  return NextResponse.json({
    enableRazorpay: false,
    enableManualUpi: false,
    enableCashfree: false,
    enableFinvedex,
    autoApprove: false,
    upiId: "",
    payeeName: "",
    qrUrl: "",
    cashfreeMode: "sandbox",
  })
}

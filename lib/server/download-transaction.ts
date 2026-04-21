export type DownloadTransactionRow = {
  id: string
  user_id: string | null
  type: "recharge" | "download"
  status: "pending" | "completed" | "failed"
  registration_number: string | null
  amount: string | number
  payment_method: "wallet" | "upi" | "razorpay" | "cashfree" | "finvedex" | null
  gateway: string | null
  gateway_order_id: string | null
}

export async function ensureDownloadTransactionCompleted(txn: DownloadTransactionRow): Promise<DownloadTransactionRow> {
  return txn
}

import type { CashfreeMode } from "@/lib/server/cashfree"

export async function loadCashfree(mode: CashfreeMode) {
  if (typeof window === "undefined") return null
  const { load } = await import("@cashfreepayments/cashfree-js")
  return load({ mode })
}


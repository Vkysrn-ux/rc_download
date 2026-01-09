declare module "@cashfreepayments/cashfree-js" {
  export type CashfreeMode = "sandbox" | "production" | (string & {})

  export function load(options: { mode: CashfreeMode }): any
}


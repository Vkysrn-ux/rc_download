export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Razorpay can only be loaded in the browser"))
  if ((window as any).Razorpay) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]')
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay")), { once: true })
      return
    }

    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Razorpay"))
    document.body.appendChild(script)
  })
}


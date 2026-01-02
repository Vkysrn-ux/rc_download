export function formatInr(value: number, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    ...options,
  }).format(value)
}


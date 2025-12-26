import crypto from "crypto"

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex")
}

export function randomOtp6(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}


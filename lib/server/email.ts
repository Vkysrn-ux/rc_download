import nodemailer from "nodemailer"

function env(name: string): string | undefined {
  return process.env[name] || undefined
}

export function isSmtpConfigured() {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS"))
}

function getTransport() {
  const host = env("SMTP_HOST")
  const user = env("SMTP_USER")
  const pass = env("SMTP_PASS")
  const port = env("SMTP_PORT") ? Number(env("SMTP_PORT")) : 587

  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  })
}

function getFrom() {
  return env("SMTP_FROM") ?? "RC Download <no-reply@example.com>"
}

export async function sendVerificationEmail(toEmail: string, verifyUrl: string) {
  console.log("[email] Verification email disabled. Link:", verifyUrl, "for", toEmail)
}

export async function sendPasswordResetOtp(toEmail: string, otp: string) {
  const transport = getTransport()
  const subject = "Your RC Download password reset code"
  const text = `Your password reset code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request this, you can ignore this email.`

  if (!transport) {
    console.log("[email] Password reset OTP code:", otp, "for", toEmail)
    return
  }

  try {
    await transport.sendMail({ from: getFrom(), to: toEmail, subject, text })
  } catch (error) {
    console.error("[email] Failed to send password reset OTP email:", error)
    console.log("[email] Password reset OTP code (fallback):", otp, "for", toEmail)
  }
}

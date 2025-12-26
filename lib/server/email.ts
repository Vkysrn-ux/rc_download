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
  const transport = getTransport()
  const subject = "Verify your email for RC Download"
  const text = `Verify your email by opening this link:\n\n${verifyUrl}\n\nIf you did not request this, ignore this email.`

  if (!transport) {
    console.log("[email] Verification link:", verifyUrl)
    return
  }

  try {
    await transport.sendMail({ from: getFrom(), to: toEmail, subject, text })
  } catch (error) {
    console.error("[email] Failed to send verification email:", error)
    console.log("[email] Verification link (fallback):", verifyUrl)
  }
}

export async function sendOtpEmail(toEmail: string, otp: string) {
  const transport = getTransport()
  const subject = "Your RC Download login OTP"
  const text = `Your one-time login code is: ${otp}\n\nThis code expires in 10 minutes.`

  if (!transport) {
    console.log("[email] OTP code:", otp, "for", toEmail)
    return
  }

  try {
    await transport.sendMail({ from: getFrom(), to: toEmail, subject, text })
  } catch (error) {
    console.error("[email] Failed to send OTP email:", error)
    console.log("[email] OTP code (fallback):", otp, "for", toEmail)
  }
}

export async function sendEmailVerificationOtp(toEmail: string, otp: string) {
  const transport = getTransport()
  const subject = "Verify your email for RC Download"
  const text = `Your email verification code is: ${otp}\n\nThis code expires in 10 minutes.`

  if (!transport) {
    console.log("[email] Verification OTP code:", otp, "for", toEmail)
    return
  }

  try {
    await transport.sendMail({ from: getFrom(), to: toEmail, subject, text })
  } catch (error) {
    console.error("[email] Failed to send verification OTP email:", error)
    console.log("[email] Verification OTP code (fallback):", otp, "for", toEmail)
  }
}

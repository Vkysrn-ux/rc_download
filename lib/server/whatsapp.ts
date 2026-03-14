/**
 * Ensure phone number has country code (defaults to 91 for India).
 * UltraMsg requires full international format without "+" prefix, e.g. "919344759416".
 */
function formatPhoneForUltraMsg(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""
  // If it already starts with country code (e.g. 91...) and is long enough, use as-is
  if (digits.length >= 12) return digits
  // Indian 10-digit numbers: prepend 91
  if (digits.length === 10) return `91${digits}`
  // Numbers starting with 0 (domestic format): strip leading 0, prepend 91
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`
  return digits
}

export async function sendWhatsAppOtp(toPhone: string, otp: string): Promise<boolean> {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID
  const token = process.env.ULTRAMSG_TOKEN

  if (!instanceId || !token) {
    console.warn("[whatsapp] UltraMsg not configured (missing ULTRAMSG_INSTANCE_ID/ULTRAMSG_TOKEN). OTP for", toPhone, ":", otp)
    return false
  }

  const to = formatPhoneForUltraMsg(toPhone)
  if (!to) {
    console.warn("[whatsapp] Invalid phone number after sanitization:", toPhone)
    return false
  }

  console.log(`[whatsapp] Sending OTP to ${to} (raw: ${toPhone}) via instance ${instanceId}`)

  try {
    const response = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token: token,
        to: to,
        body: `Your RC Download password reset code is: *${otp}*\n\nThis code expires in 10 minutes.\nDo not share this code with anyone.`,
      }),
    })

    const responseText = await response.text()
    console.log(`[whatsapp] UltraMsg response (HTTP ${response.status}):`, responseText)

    if (!response.ok) {
      console.error("[whatsapp] UltraMsg HTTP", response.status, responseText)
      return false
    }

    // UltraMsg may return 200 but with error in body (e.g. invalid number, instance not connected)
    try {
      const json = JSON.parse(responseText)
      if (json.error) {
        console.error("[whatsapp] UltraMsg API error:", json.error)
        return false
      }
      if (json.sent === "true" || json.sent === true || json.id) {
        console.log(`[whatsapp] OTP delivered to ${to}, messageId: ${json.id || "n/a"}`)
        return true
      }
    } catch {}

    console.log(`[whatsapp] OTP sent to ${to} via UltraMsg`)
    return true
  } catch (error) {
    console.error("[whatsapp] Failed to send WhatsApp OTP to", to, ":", error)
    return false
  }
}

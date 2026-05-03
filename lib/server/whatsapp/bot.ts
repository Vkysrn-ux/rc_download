import crypto from "crypto"
import { dbQuery } from "@/lib/server/db"
import { lookupRc, storeRcResult, normalizeRegistration, ExternalApiError } from "@/lib/server/rc-lookup"
import { chargeWalletForDownload, WalletError } from "@/lib/server/wallet"
import { makeFinvedexOrderId } from "@/lib/server/finvedex"
import {
  REGISTERED_RC_DOWNLOAD_PRICE_INR,
  GUEST_RC_DOWNLOAD_PRICE_INR,
  REGISTERED_PAN_DETAILS_PRICE_INR,
  GUEST_PAN_DETAILS_PRICE_INR,
  REGISTERED_RC_TO_MOBILE_PRICE_INR,
  GUEST_RC_TO_MOBILE_PRICE_INR,
  REGISTERED_RC_OWNER_HISTORY_PRICE_INR,
  GUEST_RC_OWNER_HISTORY_PRICE_INR,
} from "@/lib/pricing"
import { sendText, sendImage } from "./zingchat"
import { generatePanImage } from "./rc-image"
import { screenshotRcCard } from "./rc-screenshot"

type Service = "rc" | "pan" | "mobile" | "owner"

type User = { id: string; name: string; wallet_balance: number }

// ─── DB helpers ─────────────────────────────────────────────────────────────

let tableEnsured = false
async function ensureTable() {
  if (tableEnsured) return
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS whatsapp_pending_requests (
      id VARCHAR(36) PRIMARY KEY,
      phone VARCHAR(20) NOT NULL,
      service ENUM('rc','pan','mobile','owner') NOT NULL,
      query VARCHAR(100) NOT NULL,
      order_id VARCHAR(100),
      status ENUM('pending','completed','failed') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_order_id (order_id),
      INDEX idx_phone_status (phone, status)
    )
  `)
  tableEnsured = true
}

async function findUserByPhone(rawPhone: string): Promise<User | null> {
  const digits = rawPhone.replace(/@.*$/, "").replace(/[\s\-\+]/g, "")
  const d10 = digits.slice(-10)
  const d12 = `91${d10}`
  const rows = await dbQuery<{ id: string; name: string; wallet_balance: string | number }>(
    `SELECT id, name, wallet_balance FROM users
     WHERE phone = ? OR phone = ? OR phone = ? OR phone = ?
     LIMIT 1`,
    [digits, d10, d12, `+${d12}`],
  )
  if (!rows[0]) return null
  return { ...rows[0], wallet_balance: Number(rows[0].wallet_balance) }
}

// ─── Message parser ──────────────────────────────────────────────────────────

type Command =
  | { type: Service; query: string }
  | { type: "balance" }
  | { type: "help" }

function parseMessage(text: string): Command {
  const t = text.trim().toUpperCase()

  const rcM = t.match(/^RC\s+([A-Z0-9]+)/)
  if (rcM) return { type: "rc", query: rcM[1] }

  const panM = t.match(/^PAN\s+([A-Z0-9]+)/)
  if (panM) return { type: "pan", query: panM[1] }

  const mobM = t.match(/^MOBILE\s+([A-Z0-9]+)/)
  if (mobM) return { type: "mobile", query: mobM[1] }

  const ownM = t.match(/^OWNER\s+([A-Z0-9]+)/)
  if (ownM) return { type: "owner", query: ownM[1] }

  if (t === "BALANCE" || t === "WALLET") return { type: "balance" }

  return { type: "help" }
}

// ─── External API fetchers ───────────────────────────────────────────────────

function parseEnvJson(value: string | undefined): Record<string, string> | null {
  if (!value) return null
  let parsed: unknown
  try { parsed = JSON.parse(value) } catch { /* fall through */ }
  // Next.js may preserve literal \" in .env values without unescaping — retry
  if (parsed === undefined) try { parsed = JSON.parse(value.replace(/\\"/g, '"')) } catch { return null }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (v === null || v === undefined) continue
    out[k] = typeof v === "string" ? v : String(v)
  }
  return Object.keys(out).length ? out : null
}

function generateRsaSignature(clientId: string, publicKeyPem: string): { signature: string; timestamp: number } | null {
  try {
    const normalizedPem = publicKeyPem.replace(/\\n/g, "\n").trim()
    const timestamp = Math.floor(Date.now() / 1000)
    const encrypted = crypto.publicEncrypt(
      { key: normalizedPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
      Buffer.from(`${clientId}.${timestamp}`, "utf8"),
    )
    return { signature: encrypted.toString("base64"), timestamp }
  } catch (err: any) {
    console.error("[bot] RSA signature failed:", err?.message)
    return null
  }
}

function makeHttpFetcher(label: string, urlEnv: string, keyEnv: string, methodEnv: string, fieldEnv: string, defaultField: string) {
  return async (query: string): Promise<any> => {
    const url = (process.env[urlEnv] || "").trim()
    if (!url) throw new ExternalApiError(501, `${label} API not configured`)

    // Derive env prefix: "PAN_DETAILS_API_KEY" → "PAN_DETAILS_API"
    const prefix = keyEnv.replace(/_KEY$/, "")

    const method = (process.env[methodEnv] || "POST").trim().toUpperCase() === "GET" ? "GET" : "POST"
    const field = (process.env[fieldEnv] || defaultField).trim() || defaultField
    const apiKey = (process.env[keyEnv] || "").trim()
    const authHeader = (process.env[`${prefix}_AUTH_HEADER_NAME`] || "authorization").trim()
    const authSchemeRaw = process.env[`${prefix}_AUTH_SCHEME`]
    const authScheme = authSchemeRaw === undefined ? "Bearer" : authSchemeRaw.trim()

    // Extra headers (e.g. x-client-secret for Cashfree)
    const extraHeaders = parseEnvJson(process.env[`${prefix}_HEADERS`])
    // Extra body params (e.g. verification_id)
    const extraParams = parseEnvJson(process.env[`${prefix}_EXTRA_PARAMS`])

    // RSA signature (Cashfree requires this)
    const sigHeaderName = (process.env[`${prefix}_SIGNATURE_HEADER_NAME`] || "").trim()
    const sigTsHeaderName = (process.env[`${prefix}_SIGNATURE_TIMESTAMP_HEADER_NAME`] || "").trim()
    const sigPublicKey = (process.env[`${prefix}_SIGNATURE_PUBLIC_KEY`] || "").trim()

    const headers: Record<string, string> = { ...(extraHeaders || {}) }
    if (apiKey) headers[authHeader] = authScheme ? `${authScheme} ${apiKey}` : apiKey

    if (sigHeaderName && sigPublicKey && apiKey) {
      const sig = generateRsaSignature(apiKey, sigPublicKey)
      if (sig) {
        headers[sigHeaderName] = sig.signature
        if (sigTsHeaderName) headers[sigTsHeaderName] = String(sig.timestamp)
      }
    }

    let fetchUrl = url
    let body: string | undefined

    if (method === "GET") {
      const u = new URL(url)
      u.searchParams.set(field, query)
      if (extraParams) for (const [k, v] of Object.entries(extraParams)) u.searchParams.set(k, v)
      fetchUrl = u.toString()
    } else {
      headers["content-type"] = headers["content-type"] || "application/json"
      const payload: Record<string, unknown> = { ...(extraParams || {}), [field]: query }
      // Auto-generate numeric verification_id if set to "AUTO"
      const vid = payload["verification_id"]
      if (typeof vid === "string" && (!vid.trim() || vid.trim().toUpperCase() === "AUTO")) {
        payload["verification_id"] = `${Date.now()}${Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0")}`
      }
      body = JSON.stringify(payload)
    }

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    try {
      console.log(`[bot:${label}] → ${method} ${fetchUrl}`, body ? `body=${body.slice(0, 300)}` : "")
      const res = await fetch(fetchUrl, { method, headers, body, cache: "no-store", signal: ctrl.signal })
      const text = await res.text().catch(() => "")
      console.log(`[bot:${label}] ← HTTP ${res.status}:`, text.slice(0, 500))
      let json: any = null
      try { json = JSON.parse(text) } catch { /* not JSON */ }
      if (!res.ok) {
        const msg = (json?.error || json?.message || text || label + " failed").slice(0, 200)
        throw new ExternalApiError(res.status, msg)
      }
      return json
    } catch (err: any) {
      if (err?.name === "AbortError") throw new ExternalApiError(504, `${label} request timed out`)
      throw err
    } finally {
      clearTimeout(timer)
    }
  }
}

const fetchPan = makeHttpFetcher(
  "PAN", "PAN_DETAILS_API_URL", "PAN_DETAILS_API_KEY",
  "PAN_DETAILS_API_METHOD", "PAN_DETAILS_API_PAYLOAD_FIELD", "pan",
)
const fetchMobile = makeHttpFetcher(
  "RC-to-Mobile", "RC_TO_MOBILE_API_URL", "RC_TO_MOBILE_API_KEY",
  "RC_TO_MOBILE_API_METHOD", "RC_TO_MOBILE_API_PAYLOAD_FIELD", "vrn",
)
const fetchOwner = makeHttpFetcher(
  "Owner History", "RC_OWNER_HISTORY_API_URL", "RC_OWNER_HISTORY_API_KEY",
  "RC_OWNER_HISTORY_API_METHOD", "RC_OWNER_HISTORY_API_PAYLOAD_FIELD", "vrn",
)

// ─── Text formatters ─────────────────────────────────────────────────────────

function formatMobile(reg: string, json: any): string {
  const mobile =
    json?.mobile ||
    json?.mobile_number ||
    json?.phone ||
    json?.result?.mobile ||
    json?.result?.mobile_number ||
    json?.data?.mobile ||
    json?.data?.mobile_number ||
    json?.data?.phone ||
    ""
  if (!mobile) return `No mobile number found linked to ${reg}.`
  return `📱 *RC to Mobile*\n\nVehicle: *${reg}*\nLinked Mobile: *${mobile}*`
}

function formatOwner(reg: string, json: any): string {
  const owners: any[] =
    json?.owners ||
    json?.owner_history ||
    json?.result?.owners ||
    json?.result?.owner_history ||
    json?.data?.owners ||
    json?.data?.owner_history ||
    []

  if (!owners.length) {
    const name = json?.owner_name || json?.result?.owner_name || json?.data?.owner_name || ""
    return `🚗 *Owner History for ${reg}*\n\n${name ? `Current Owner: *${name}*\nNo previous ownership history found.` : "No ownership history found."}`
  }

  const lines = owners.map((o: any, i: number) => {
    const name = o.owner_name || o.name || o.owner || `Owner ${i + 1}`
    const from = o.from || o.reg_date || o.transfer_date || ""
    const to = o.to || o.sale_date || ""
    return `${i + 1}. *${name}*${from ? `\n   From: ${from}` : ""}${to ? ` → ${to}` : ""}`
  })

  return `🚗 *Owner History for ${reg}*\n\n${lines.join("\n\n")}`
}

// ─── Payment helpers ─────────────────────────────────────────────────────────

async function createWhatsappPayment(phone: string, service: Service, query: string, _amount: number): Promise<string> {
  await ensureTable()

  const pendingId = crypto.randomUUID()
  const orderId = makeFinvedexOrderId(pendingId)
  // Use production URL — Finvedex is whitelisted for vehiclercdownload.com, not local dev.
  // Payment is created on the website so it goes through the whitelisted server.
  const appUrl = (process.env.APP_BASE_URL || "https://vehiclercdownload.com").replace(/\/$/, "")

  await dbQuery(
    `INSERT INTO whatsapp_pending_requests (id, phone, service, query, order_id, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [pendingId, phone, service, query.toUpperCase(), orderId],
  )

  return `${appUrl}/pay/whatsapp?id=${pendingId}`
}

// ─── Service handlers ─────────────────────────────────────────────────────────

async function handleRc(phone: string, query: string, user: User | null) {
  const reg = normalizeRegistration(query)

  if (!user || user.wallet_balance < REGISTERED_RC_DOWNLOAD_PRICE_INR) {
    const price = GUEST_RC_DOWNLOAD_PRICE_INR
    let payUrl: string
    try {
      payUrl = await createWhatsappPayment(phone, "rc", reg, price)
    } catch (err: any) {
      console.error(`[wa-bot] RC payment creation failed for ${reg}:`, err?.message || err)
      await sendText(phone, `❌ Unable to create payment. Please visit vehiclercdownload.com to get your RC details.`)
      return
    }
    const balanceNote = user
      ? `\n\n⚠️ Wallet balance: ₹${user.wallet_balance} (need ₹${REGISTERED_RC_DOWNLOAD_PRICE_INR})\nPay directly below:`
      : ""
    await sendText(
      phone,
      `🚗 *RC Details for ${reg}*${balanceNote}\n\nPay ₹${price} to receive your RC certificate image:\n\n${payUrl}\n\nYour RC image will be sent automatically after payment.`,
    )
    return
  }

  await sendText(phone, `⏳ Fetching RC details for *${reg}*...`)

  try {
    const result = await lookupRc(reg, { userId: user.id, bypassCache: false })
    if (!result) {
      await sendText(phone, `❌ Vehicle *${reg}* not found. Please check the registration number.`)
      return
    }

    await storeRcResult(result.registrationNumber, user.id, result.data, result.provider, result.providerRef).catch(() => {})
    await chargeWalletForDownload({
      userId: user.id,
      registrationNumber: result.registrationNumber,
      price: REGISTERED_RC_DOWNLOAD_PRICE_INR,
      description: `WhatsApp RC - ${result.registrationNumber}`,
    })

    const imgBuffer = await screenshotRcCard(result.data)
    await sendImage(phone, imgBuffer.toString("base64"), `RC Details: ${result.registrationNumber}`, "image/jpeg")
  } catch (err: any) {
    if (err instanceof WalletError) {
      await sendText(phone, `⚠️ ${err.message}`)
    } else if (err instanceof ExternalApiError && err.status === 404) {
      await sendText(phone, `❌ Vehicle *${reg}* not found. Please check the registration number.`)
    } else {
      await sendText(phone, `❌ Unable to fetch RC details right now. Please try again later.`)
    }
  }
}

async function handlePan(phone: string, query: string, user: User | null) {
  const pan = query.toUpperCase().replace(/\s/g, "")

  if (!user || user.wallet_balance < REGISTERED_PAN_DETAILS_PRICE_INR) {
    const price = GUEST_PAN_DETAILS_PRICE_INR
    let payUrl: string
    try {
      payUrl = await createWhatsappPayment(phone, "pan", pan, price)
    } catch (err: any) {
      console.error(`[wa-bot] PAN payment creation failed for ${pan}:`, err?.message || err)
      await sendText(phone, `❌ Unable to create payment. Please visit vehiclercdownload.com`)
      return
    }
    const balanceNote = user
      ? `\n\n⚠️ Wallet balance: ₹${user.wallet_balance} (need ₹${REGISTERED_PAN_DETAILS_PRICE_INR})\nPay directly below:`
      : ""
    await sendText(
      phone,
      `📋 *PAN Details for ${pan}*${balanceNote}\n\nPay ₹${price} to receive PAN details:\n\n${payUrl}\n\nDetails will be sent automatically after payment.`,
    )
    return
  }

  await sendText(phone, `⏳ Fetching PAN details for *${pan}*...`)

  try {
    const data = await fetchPan(pan)
    await chargeWalletForDownload({
      userId: user.id,
      registrationNumber: pan,
      price: REGISTERED_PAN_DETAILS_PRICE_INR,
      description: `WhatsApp PAN - ${pan}`,
    })
    const imgBuffer = await generatePanImage(pan, data)
    await sendImage(phone, imgBuffer.toString("base64"), `PAN Details: ${pan}`, "image/png")
  } catch (err: any) {
    console.error(`[wa-bot] PAN lookup failed for ${pan}:`, err?.message || err)
    if (err instanceof WalletError) {
      await sendText(phone, `⚠️ ${err.message}`)
    } else if (err instanceof ExternalApiError && err.status === 404) {
      await sendText(phone, `❌ PAN *${pan}* not found.`)
    } else {
      await sendText(phone, `❌ Unable to fetch PAN details right now. Please try again later.\n\nError: ${err?.message || "Unknown error"}`)
    }
  }
}

async function handleMobile(phone: string, query: string, user: User | null) {
  const reg = normalizeRegistration(query)

  if (!user || user.wallet_balance < REGISTERED_RC_TO_MOBILE_PRICE_INR) {
    const price = GUEST_RC_TO_MOBILE_PRICE_INR
    let payUrl: string
    try {
      payUrl = await createWhatsappPayment(phone, "mobile", reg, price)
    } catch {
      await sendText(phone, `❌ Unable to create payment. Please visit vehiclercdownload.com`)
      return
    }
    const balanceNote = user ? ` (wallet: ₹${user.wallet_balance}, need ₹${REGISTERED_RC_TO_MOBILE_PRICE_INR})` : ""
    await sendText(
      phone,
      `📱 *RC to Mobile for ${reg}*${balanceNote}\n\nPay ₹${price} to get linked mobile number:\n\n${payUrl}\n\nResult will be sent after payment.`,
    )
    return
  }

  await sendText(phone, `⏳ Looking up mobile for *${reg}*...`)

  try {
    const data = await fetchMobile(reg)
    await chargeWalletForDownload({
      userId: user.id,
      registrationNumber: reg,
      price: REGISTERED_RC_TO_MOBILE_PRICE_INR,
      description: `WhatsApp RC-to-Mobile - ${reg}`,
    })
    await sendText(phone, formatMobile(reg, data))
  } catch (err: any) {
    if (err instanceof WalletError) {
      await sendText(phone, `⚠️ ${err.message}`)
    } else {
      await sendText(phone, `❌ Unable to fetch mobile number for *${reg}*. Please try again.`)
    }
  }
}

async function handleOwner(phone: string, query: string, user: User | null) {
  const reg = normalizeRegistration(query)

  if (!user || user.wallet_balance < REGISTERED_RC_OWNER_HISTORY_PRICE_INR) {
    const price = GUEST_RC_OWNER_HISTORY_PRICE_INR
    let payUrl: string
    try {
      payUrl = await createWhatsappPayment(phone, "owner", reg, price)
    } catch {
      await sendText(phone, `❌ Unable to create payment. Please visit vehiclercdownload.com`)
      return
    }
    const balanceNote = user ? ` (wallet: ₹${user.wallet_balance}, need ₹${REGISTERED_RC_OWNER_HISTORY_PRICE_INR})` : ""
    await sendText(
      phone,
      `🚗 *Owner History for ${reg}*${balanceNote}\n\nPay ₹${price} to get ownership history:\n\n${payUrl}\n\nResult will be sent after payment.`,
    )
    return
  }

  await sendText(phone, `⏳ Fetching owner history for *${reg}*...`)

  try {
    const data = await fetchOwner(reg)
    await chargeWalletForDownload({
      userId: user.id,
      registrationNumber: reg,
      price: REGISTERED_RC_OWNER_HISTORY_PRICE_INR,
      description: `WhatsApp Owner History - ${reg}`,
    })
    await sendText(phone, formatOwner(reg, data))
  } catch (err: any) {
    if (err instanceof WalletError) {
      await sendText(phone, `⚠️ ${err.message}`)
    } else {
      await sendText(phone, `❌ Unable to fetch owner history for *${reg}*. Please try again.`)
    }
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

const HELP_TEXT = `👋 *Welcome to RC Download Bot*

Send a command to get started:

🚗 *RC <vehicle number>* — Get RC certificate image
📋 *PAN <pan number>* — Get PAN details
📱 *Mobile <vehicle number>* — Get linked mobile number
👤 *Owner <vehicle number>* — Get ownership history
💰 *Balance* — Check your wallet balance

🌐 Website: vehiclercdownload.com

_Registered users: charges deducted from wallet_
_New users: pay per request via payment link_`

export async function handleWhatsappMessage(jid: string, messageText: string) {
  const phone = jid.replace(/@.*$/, "")

  let user: User | null = null
  try {
    user = await findUserByPhone(phone)
  } catch (err) {
    console.error("[wa-bot] DB error finding user:", err)
  }

  const cmd = parseMessage(messageText)

  if (cmd.type === "help") {
    const greeting = user ? `Hi *${user.name}*! 👋\n\n` : ""
    await sendText(phone, greeting + HELP_TEXT)
    return
  }

  if (cmd.type === "balance") {
    if (!user) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vehiclercdownload.com"
      await sendText(phone, `You don't have a registered account.\n\nSign up at ${appUrl} to get a wallet and discounted rates.`)
    } else {
      await sendText(phone, `💰 *Wallet Balance*\n\nHi ${user.name},\nCurrent balance: *₹${user.wallet_balance}*`)
    }
    return
  }

  if (cmd.type === "rc") await handleRc(phone, cmd.query, user)
  else if (cmd.type === "pan") await handlePan(phone, cmd.query, user)
  else if (cmd.type === "mobile") await handleMobile(phone, cmd.query, user)
  else if (cmd.type === "owner") await handleOwner(phone, cmd.query, user)
}

// ─── Post-payment fulfillment (called from Finvedex webhook) ─────────────────

export async function fulfillWhatsappPending(orderId: string) {
  await ensureTable()

  const rows = await dbQuery<{
    id: string
    phone: string
    service: Service
    query: string
    status: string
  }>(
    "SELECT id, phone, service, query, status FROM whatsapp_pending_requests WHERE order_id = ? LIMIT 1",
    [orderId],
  )

  const pending = rows[0]
  if (!pending || pending.status !== "pending") return

  await dbQuery("UPDATE whatsapp_pending_requests SET status = 'completed' WHERE id = ?", [pending.id])

  const { phone, service, query } = pending

  try {
    if (service === "rc") {
      const reg = normalizeRegistration(query)
      const result = await lookupRc(reg, { userId: null, bypassCache: false })
      if (!result) {
        await sendText(phone, `❌ Vehicle *${reg}* not found after payment. Please contact support.`)
        return
      }
      await storeRcResult(result.registrationNumber, null, result.data, result.provider, result.providerRef).catch(() => {})
      const imgBuffer = await screenshotRcCard(result.data)
      await sendImage(phone, imgBuffer.toString("base64"), `RC Details: ${result.registrationNumber}`, "image/jpeg")
    } else if (service === "pan") {
      const pan = query.toUpperCase()
      const data = await fetchPan(pan)
      const imgBuffer = await generatePanImage(pan, data)
      await sendImage(phone, imgBuffer.toString("base64"), `PAN Details: ${pan}`, "image/png")
    } else if (service === "mobile") {
      const reg = normalizeRegistration(query)
      const data = await fetchMobile(reg)
      await sendText(phone, formatMobile(reg, data))
    } else if (service === "owner") {
      const reg = normalizeRegistration(query)
      const data = await fetchOwner(reg)
      await sendText(phone, formatOwner(reg, data))
    }
  } catch (err: any) {
    console.error(`[wa-bot] fulfillment failed for order ${orderId}:`, err?.message)
    await dbQuery("UPDATE whatsapp_pending_requests SET status = 'failed' WHERE id = ?", [pending.id]).catch(() => {})
    await sendText(phone, `❌ Payment received but service is temporarily unavailable. Please contact support with reference: ${orderId}`)
  }
}

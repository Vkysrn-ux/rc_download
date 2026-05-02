import type { NormalizedRCData } from "@/lib/server/rc-normalize"
import { storeRenderToken } from "./render-store"

// Lazy-load puppeteer so it doesn't slow down cold starts on other routes
async function getPuppeteer() {
  const puppeteer = await import("puppeteer")
  return puppeteer.default
}

// Singleton browser — stays alive between requests
const g = globalThis as any

async function getBrowser() {
  if (g.__rcPuppeteerBrowser?.connected) return g.__rcPuppeteerBrowser

  const puppeteer = await getPuppeteer()
  const isLinux = process.platform === "linux"
  g.__rcPuppeteerBrowser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      // --single-process is Linux-only; skip on Windows/Mac
      ...(isLinux ? ["--single-process"] : []),
    ],
  })
  return g.__rcPuppeteerBrowser
}

function getLocalUrl() {
  // Use internal URL so Puppeteer bypasses any external proxy/SSL
  const port = process.env.PORT || "3000"
  return `http://localhost:${port}`
}

export async function screenshotRcCard(data: NormalizedRCData): Promise<Buffer> {
  const token = storeRenderToken(data)
  const base = getLocalUrl()
  const url = `${base}/whatsapp/rc-render?token=${token}`

  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    // 700px wide fits both 640px cards with 20px padding each side
    await page.setViewport({ width: 700, height: 1000 })

    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })

    // Wait for RC component to signal it's fully rendered (QR code done)
    await page.waitForSelector("#rc-portrait-ready", { timeout: 15000 }).catch(() => {
      // If timeout, screenshot whatever is rendered
      console.warn("[rc-screenshot] Ready signal not received, screenshotting anyway")
    })

    const container = await page.$("#rc-portrait-container")
    if (!container) throw new Error("RC portrait container not found in page")

    const screenshot = await container.screenshot({ type: "jpeg", quality: 85 })
    const buf = Buffer.from(screenshot)
    console.log(`[rc-screenshot] captured ${(buf.length / 1024).toFixed(0)} KB`)
    return buf
  } finally {
    await page.close().catch(() => {})
  }
}

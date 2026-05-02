import { NextResponse } from "next/server"
import { handleWhatsappMessage } from "@/lib/server/whatsapp/bot"

function extractText(message: Record<string, any>): string {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    message?.buttonsResponseMessage?.selectedDisplayText ||
    message?.listResponseMessage?.title ||
    ""
  )
}

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // Respond immediately — process async (fire-and-forget)
  process.nextTick(async () => {
    try {
      const items: any[] = Array.isArray(body?.data) ? body.data : body?.data ? [body.data] : []
      for (const item of items) {
        if (body?.event !== "messages.upsert") continue
        const key = item?.key || {}
        if (key.fromMe) continue
        if ((key.remoteJid || "").endsWith("@g.us")) continue

        const ts = Number(item?.messageTimestamp || 0)
        if (ts && Date.now() / 1000 - ts > 60) continue

        const jid: string = key.remoteJid || ""
        const text = extractText(item?.message || {}).trim()
        if (!jid || !text) continue

        await handleWhatsappMessage(jid, text)
      }
    } catch (err) {
      console.error("[wa-webhook] handler error:", err)
    }
  })

  return NextResponse.json({ ok: true })
}

// Zingchat may probe with GET
export async function GET() {
  return NextResponse.json({ ok: true })
}

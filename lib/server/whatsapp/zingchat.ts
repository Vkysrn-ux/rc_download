function cfg() {
  const url = process.env.ZINGCHAT_API_URL || ""
  const key = process.env.ZINGCHAT_API_KEY || ""
  const instance = process.env.ZINGCHAT_INSTANCE || "RC"
  if (!url || !key) throw new Error("Missing ZINGCHAT_API_URL or ZINGCHAT_API_KEY")
  return { url, key, instance }
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/@.*$/, "").replace(/[\s\-\+]/g, "")
  if (p.length === 10) p = `91${p}`
  return p
}

async function post(path: string, body: unknown) {
  const { url, key, instance } = cfg()
  const res = await fetch(`${url}/api/v1/message/${path}/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    console.error(`[zingchat] ${path} failed: ${res.status} ${text.slice(0, 500)}`)
    throw new Error(`zingchat ${path} failed: ${res.status}`)
  }
  return res
}

export async function sendText(phone: string, text: string) {
  await post("sendText", { number: normalizePhone(phone), text })
}

export async function sendImage(phone: string, base64: string, caption?: string, mimeType = "image/jpeg") {
  // Evolution API expects raw base64 or a URL, NOT a data URI prefix.
  const media = base64.replace(/^data:.*?;base64,/, "");
  const ext = mimeType === "image/png" ? "png" : "jpg"
  await post("sendMedia", {
    number: normalizePhone(phone),
    mediatype: "image",
    mimetype: mimeType,
    media,
    caption: caption || "",
    fileName: `rc-certificate.${ext}`,
  })
}

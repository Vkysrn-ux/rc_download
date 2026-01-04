"use client"

import html2canvas from "html2canvas"

function sanitizeWhatsAppNumber(value: string) {
  return (value || "").replace(/[^\d]/g, "")
}

export function buildWhatsAppAdminUrl(adminNumber: string, text: string) {
  const digits = sanitizeWhatsAppNumber(adminNumber)
  if (!digits) return ""
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export async function captureElementAsPngBlob(element: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: Math.max(2, window.devicePixelRatio || 1),
    useCORS: true,
  })

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) reject(new Error("Failed to create PNG blob"))
      else resolve(b)
    }, "image/png")
  })

  return blob
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function shareManualPaymentProof(params: {
  adminNumber: string
  message: string
  screenshotEl?: HTMLElement | null
  filename?: string
}) {
  const url = buildWhatsAppAdminUrl(params.adminNumber, params.message)
  const filename = params.filename || `manual-payment-${Date.now()}.png`

  let blob: Blob | null = null
  if (params.screenshotEl) {
    blob = await captureElementAsPngBlob(params.screenshotEl).catch(() => null)
  }

  if (blob && "share" in navigator) {
    try {
      const file = new File([blob], filename, { type: "image/png" })
      const canShareFiles = "canShare" in navigator && (navigator as any).canShare?.({ files: [file] })
      if (canShareFiles) {
        await (navigator as any).share({ files: [file], text: params.message, title: "Manual Payment Proof" })
        return { ok: true as const, method: "share" as const }
      }
    } catch {
      // fall through to WhatsApp link + download fallback
    }
  }

  if (blob) downloadBlob(blob, filename)
  if (url) window.open(url, "_blank", "noopener,noreferrer")

  return { ok: Boolean(url), method: "link" as const, url }
}


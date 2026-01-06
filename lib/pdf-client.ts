export type PdfImageFormat = "jpeg" | "png"
export type PdfImageCompression = "NONE" | "FAST" | "MEDIUM" | "SLOW"

export type ClientPdfSettings = {
  captureScale: number
  imageFormat: PdfImageFormat
  jpegQuality: number
  compressStreams: boolean
  imageCompression: PdfImageCompression
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function parseNumber(value: string | undefined) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (value == null) return defaultValue
  const normalized = value.trim().toLowerCase()
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false
  return defaultValue
}

function parseImageFormat(value: string | undefined): PdfImageFormat {
  const normalized = (value || "").trim().toLowerCase()
  return normalized === "png" ? "png" : "jpeg"
}

function parseCompression(value: string | undefined): PdfImageCompression {
  const normalized = (value || "").trim().toUpperCase()
  if (normalized === "NONE" || normalized === "FAST" || normalized === "MEDIUM" || normalized === "SLOW") return normalized
  return "FAST"
}

export function getClientPdfSettings(): ClientPdfSettings {
  const captureScale = clampNumber(parseNumber(process.env.NEXT_PUBLIC_PDF_CAPTURE_SCALE) ?? 1.25, 0.5, 2)
  const imageFormat = parseImageFormat(process.env.NEXT_PUBLIC_PDF_IMAGE_FORMAT)
  const jpegQuality = clampNumber(parseNumber(process.env.NEXT_PUBLIC_PDF_JPEG_QUALITY) ?? 0.7, 0.1, 0.95)
  const compressStreams = parseBoolean(process.env.NEXT_PUBLIC_PDF_COMPRESS, true)
  const imageCompression = parseCompression(process.env.NEXT_PUBLIC_PDF_IMAGE_COMPRESSION)

  return { captureScale, imageFormat, jpegQuality, compressStreams, imageCompression }
}

export function canvasToPdfImage(
  canvas: HTMLCanvasElement,
  settings: Pick<ClientPdfSettings, "imageFormat" | "jpegQuality">,
) {
  if (settings.imageFormat === "png") return { dataUrl: canvas.toDataURL("image/png"), jsPdfFormat: "PNG" as const }
  return {
    dataUrl: canvas.toDataURL("image/jpeg", settings.jpegQuality),
    jsPdfFormat: "JPEG" as const,
  }
}

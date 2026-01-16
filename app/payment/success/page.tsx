"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, FileImage, FileText, Smartphone } from "lucide-react"
import { RCDocumentTemplate } from "@/components/rc-document-template"
import VirtualRcTemplate from "@/components/virtual-rc"
import { RcApiProgressChecklist, type RcApiStepStatus } from "@/components/rc-api-progress-checklist"
import { RcDownloadStepper } from "@/components/rc-download-stepper"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { canvasToPdfImage, getClientPdfSettings } from "@/lib/pdf-client"

const PDF_COMBINED_WIDTH_MM = 320

function PaymentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useAuth()
  const registration = searchParams.get("registration") || ""
  const transactionId = searchParams.get("transactionId") || ""
  const [downloading, setDownloading] = useState(false)
  const [downloadType, setDownloadType] = useState<"image" | "pdf" | null>(null)
  const [rcLoading, setRcLoading] = useState(false)
  const [rcData, setRcData] = useState<any | null>(null)
  const [rcError, setRcError] = useState<string>("")
  const [downloadError, setDownloadError] = useState<string>("")
  const [resultView, setResultView] = useState<"documents" | "mparivahan">("documents")
  const [apiSteps, setApiSteps] = useState<RcApiStepStatus[] | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!registration) return
    if (!transactionId) {
      setRcData(null)
      setRcError("Missing transactionId. Please complete payment to view RC.")
      setRcLoading(false)
      setApiSteps(null)
      return
    }

    setRcLoading(true)
    setRcError("")
    setApiSteps(["active", "pending"])

    eventSourceRef.current?.close()
    const url = `/api/rc/view/stream?transactionId=${encodeURIComponent(transactionId)}&fresh=1`
    const source = new EventSource(url)
    eventSourceRef.current = source

    const markActive = (stepIndex: number) => {
      setApiSteps((prev) => {
        const next = (prev ?? ["pending", "pending"]).slice(0, 2) as RcApiStepStatus[]
        for (let i = 0; i < next.length; i++) {
          if (i !== stepIndex && next[i] === "active") next[i] = "pending"
        }
        next[stepIndex] = "active"
        return next
      })
    }

    const markState = (stepIndex: number, state: RcApiStepStatus) => {
      setApiSteps((prev) => {
        const next = (prev ?? ["pending", "pending"]).slice(0, 2) as RcApiStepStatus[]
        next[stepIndex] = state
        return next
      })
    }

    source.addEventListener("progress", (event) => {
      const payload = JSON.parse((event as MessageEvent).data || "{}")
      const stepIndex = Number(payload?.stepIndex)
      const state = String(payload?.state || "")
      if (!Number.isFinite(stepIndex) || stepIndex < 0 || stepIndex > 1) return
      if (state === "active") markActive(stepIndex)
      else if (state === "failure") markState(stepIndex, "failure")
      else if (state === "success") markState(stepIndex, "success")
    })

    source.addEventListener("done", (event) => {
      const payload = JSON.parse((event as MessageEvent).data || "{}")
      setRcData(payload?.data ?? null)
      setRcLoading(false)
      source.close()
    })

    source.addEventListener("not_found", (event) => {
      const payload = JSON.parse((event as MessageEvent).data || "{}")
      setRcData(null)
      setRcError(payload?.error || "RC data not found")
      setRcLoading(false)
      source.close()
    })

    source.addEventListener("server_error", (event) => {
      const payload = JSON.parse((event as MessageEvent).data || "{}")
      setRcData(null)
      setRcError(payload?.error || "RC data not found")
      const status = Number(payload?.status)
      if (status === 400 || status === 402) setApiSteps(null)
      setRcLoading(false)
      source.close()
    })

    source.onerror = () => {
      setRcData(null)
      setRcError("RC data not found")
      setRcLoading(false)
      source.close()
    }

    return () => {
      source.close()
    }
  }, [registration, transactionId])

  const captureCombinedCanvas = async (scale = 2) => {
    const element = document.getElementById("rc-combined-capture")
    if (!element) throw new Error("RC capture element not found")
    setDownloadError("")
    await document.fonts?.ready
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    // Ensure all images inside the capture area are loaded before rendering to canvas.
    const images = Array.from(element.querySelectorAll("img"))
    await Promise.race([
      Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve()
              img.addEventListener("load", () => resolve(), { once: true })
              img.addEventListener("error", () => resolve(), { once: true })
            }),
        ),
      ),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ])

    // html2canvas can't parse modern color functions like `lab()`/`oklch()`.
    // Tailwind theme variables can resolve to those formats in computed styles, so override them temporarily.
    const root = document.documentElement
    const body = document.body
    const originalRootStyle = root.getAttribute("style") || ""
    const originalBodyStyle = body.getAttribute("style") || ""

    root.style.setProperty("--background", "#ffffff")
    root.style.setProperty("--foreground", "#111111")
    root.style.setProperty("--card", "#ffffff")
    root.style.setProperty("--card-foreground", "#111111")
    root.style.setProperty("--popover", "#ffffff")
    root.style.setProperty("--popover-foreground", "#111111")
    root.style.setProperty("--primary", "#111111")
    root.style.setProperty("--primary-foreground", "#ffffff")
    root.style.setProperty("--secondary", "#f3f4f6")
    root.style.setProperty("--secondary-foreground", "#111111")
    root.style.setProperty("--muted", "#f3f4f6")
    root.style.setProperty("--muted-foreground", "#6b7280")
    root.style.setProperty("--accent", "#f3f4f6")
    root.style.setProperty("--accent-foreground", "#111111")
    root.style.setProperty("--destructive", "#ef4444")
    root.style.setProperty("--destructive-foreground", "#ffffff")
    root.style.setProperty("--border", "#e5e7eb")
    root.style.setProperty("--input", "#e5e7eb")
    root.style.setProperty("--ring", "#93c5fd")
    root.style.backgroundColor = "#ffffff"
    body.style.background = "none"
    body.style.backgroundColor = "#ffffff"
    body.style.color = "#000000"

    try {
      return await html2canvas(element, {
        scale,
        backgroundColor: "#ffffff",
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
      })
    } finally {
      root.setAttribute("style", originalRootStyle)
      body.setAttribute("style", originalBodyStyle)
    }
  }

  const handleDownloadImage = async () => {
    setDownloading(true)
    setDownloadType("image")

    try {
      const canvas = await captureCombinedCanvas()
      const link = document.createElement("a")
      link.download = `RC_${registration}_Combined.png`
      link.href = canvas.toDataURL("image/png")
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error("Error generating images:", error)
      setDownloadError(error instanceof Error ? error.message : "Failed to generate image")
    }

    setDownloading(false)
    setDownloadType(null)
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    setDownloadType("pdf")

    try {
      const settings = getClientPdfSettings()
      const canvas = await captureCombinedCanvas(settings.captureScale)
      const { dataUrl, jsPdfFormat } = canvasToPdfImage(canvas, settings)
      const pdfHeightMm = Math.round((PDF_COMBINED_WIDTH_MM * canvas.height) / canvas.width * 10) / 10

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [PDF_COMBINED_WIDTH_MM, pdfHeightMm],
        compress: settings.compressStreams,
      })

      pdf.addImage(
        dataUrl,
        jsPdfFormat,
        0,
        0,
        PDF_COMBINED_WIDTH_MM,
        pdfHeightMm,
        undefined,
        settings.imageCompression === "NONE" ? undefined : settings.imageCompression,
      )
      pdf.save(`RC_${registration}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
      setDownloadError(error instanceof Error ? error.message : "Failed to generate PDF")
    }

    setDownloading(false)
    setDownloadType(null)
  }

  const captureElementCanvas = async (elementId: string, scale = 2) => {
    const element = document.getElementById(elementId)
    if (!element) throw new Error("Capture element not found")
    setDownloadError("")
    await document.fonts?.ready
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const images = Array.from(element.querySelectorAll("img"))
    await Promise.race([
      Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve()
              img.addEventListener("load", () => resolve(), { once: true })
              img.addEventListener("error", () => resolve(), { once: true })
            }),
        ),
      ),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ])

    // Temporarily force white background like existing capture
    const root = document.documentElement
    const body = document.body
    const originalRootStyle = root.getAttribute("style") || ""
    const originalBodyStyle = body.getAttribute("style") || ""

    root.style.setProperty("--background", "#ffffff")
    body.style.backgroundColor = "#ffffff"
    try {
      return await html2canvas(element, { scale, backgroundColor: "#ffffff", useCORS: true, scrollX: 0, scrollY: 0 })
    } finally {
      root.setAttribute("style", originalRootStyle)
      body.setAttribute("style", originalBodyStyle)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <div className="max-w-[1400px] mx-auto space-y-6 py-8">
        <div className="max-w-5xl mx-auto">
          <RcDownloadStepper step={3} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Document Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {rcError && <div className="text-sm text-destructive">{rcError}</div>}
            {downloadError && <div className="text-sm text-destructive mt-2">{downloadError}</div>}
            {(rcLoading || apiSteps) && <RcApiProgressChecklist active={rcLoading} steps={apiSteps} className="mt-3" />}
            {rcData && (
              <div className="mt-4 rounded-xl border bg-white p-2 md:p-4 shadow-sm overflow-x-auto">
                {resultView === "mparivahan" ? (
                  <div className="flex justify-center">
                    <div className="overflow-x-auto">
                      <VirtualRcTemplate
                        data={rcData}
                        id="rc-virtual-preview-full"
                        showReturnButton
                        returnHref="/"
                        returnLabel="Return to Home"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex min-w-max justify-center gap-3 items-start">
                      <RCDocumentTemplate data={rcData} side="front" id="rc-front-preview" />
                      <RCDocumentTemplate data={rcData} side="back" id="rc-back-preview" />
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <div className="grid md:grid-cols-4 gap-3 w-full">
              <Button
                size="lg"
                onClick={handleDownloadImage}
                disabled={downloading || !rcData}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {downloading && downloadType === "image" ? (
                  "Generating Image..."
                ) : (
                  <>
                    <FileImage className="h-4 w-4 mr-2" />
                    Download PNG
                  </>
                )}
              </Button>
              <Button
                size="lg"
                onClick={handleDownloadPDF}
                disabled={downloading || !rcData}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {downloading && downloadType === "pdf" ? (
                  "Generating PDF..."
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Download as PDF
                  </>
                )}
              </Button>
              <Button
                size="lg"
                variant={resultView === "mparivahan" ? "default" : "outline"}
                className={resultView === "mparivahan" ? "" : "bg-transparent"}
                onClick={() => setResultView((prev) => (prev === "mparivahan" ? "documents" : "mparivahan"))}
                disabled={!rcData}
              >
                <Smartphone className="h-4 w-4 mr-2" />
                {resultView === "mparivahan" ? "Show Documents" : "mParivahan"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent"
                onClick={() => router.push(isAuthenticated ? "/dashboard" : "/")}
              >
                <Home className="h-4 w-4 mr-2" />
                {isAuthenticated ? "Back to Dashboard" : "Back to Home"}
              </Button>
            </div>
          </CardFooter>
        </Card>

        {rcData && (
          <div
            aria-hidden="true"
            className="fixed pointer-events-none"
            style={{ left: "0px", top: "0px", zIndex: -1, width: "1px", height: "1px", overflow: "visible" }}
          >
            <div id="rc-combined-capture" className="inline-flex bg-white">
              <RCDocumentTemplate data={rcData} side="front" id="rc-front-capture" />
              <RCDocumentTemplate data={rcData} side="back" id="rc-back-capture" />
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  )
}

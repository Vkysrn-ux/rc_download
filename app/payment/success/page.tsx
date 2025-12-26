"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Home, FileImage, FileText } from "lucide-react"
import { RCDocumentTemplate } from "@/components/rc-document-template"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

const PDF_COMBINED_WIDTH_MM = 320

function PaymentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useAuth()
  const registration = searchParams.get("registration") || ""
  const [downloading, setDownloading] = useState(false)
  const [downloadType, setDownloadType] = useState<"image" | "pdf" | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [rcData, setRcData] = useState<any | null>(null)
  const [rcError, setRcError] = useState<string>("")
  const [downloadError, setDownloadError] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!registration) return
      setRcError("")
      const res = await fetch(`/api/rc/lookup?registrationNumber=${encodeURIComponent(registration)}`)
      const json = await res.json().catch(() => ({}))
      if (cancelled) return
      if (!res.ok) {
        setRcData(null)
        setRcError(json?.error || "RC data not found")
      } else {
        setRcData(json.data)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [registration])

  const captureCombinedCanvas = async () => {
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
        scale: 2,
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
      const canvas = await captureCombinedCanvas()
      const imgData = canvas.toDataURL("image/png")
      const pdfHeightMm = Math.round((PDF_COMBINED_WIDTH_MM * canvas.height) / canvas.width * 10) / 10

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [PDF_COMBINED_WIDTH_MM, pdfHeightMm],
      })

      pdf.addImage(imgData, "PNG", 0, 0, PDF_COMBINED_WIDTH_MM, pdfHeightMm)
      pdf.save(`RC_${registration}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
      setDownloadError(error instanceof Error ? error.message : "Failed to generate PDF")
    }

    setDownloading(false)
    setDownloadType(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
      <div className="max-w-[1400px] mx-auto space-y-6 py-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-green-100 rounded-full">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-balance">Payment Successful!</h1>
          <p className="text-muted-foreground">Your RC document is ready to download</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Document Details</CardTitle>
          </CardHeader>
          <CardContent>
            {rcError && <div className="text-sm text-destructive">{rcError}</div>}
            {downloadError && <div className="text-sm text-destructive mt-2">{downloadError}</div>}
            {rcData && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Registration Number</div>
                  <div className="font-medium">{rcData.registrationNumber}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Owner Name</div>
                  <div className="font-medium">{rcData.ownerName}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Vehicle</div>
                  <div className="font-medium">
                    {rcData.maker} {rcData.model}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Fuel Type</div>
                  <div className="font-medium">{rcData.fuelType}</div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full bg-transparent"
              onClick={() => setShowPreview(!showPreview)}
              disabled={!rcData}
            >
              {showPreview ? "Hide" : "Show"} Document Preview
            </Button>

            <div className="grid md:grid-cols-2 gap-3 w-full">
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
                    Download as Image
                  </>
                )}
              </Button>
              <Button
                size="lg"
                onClick={handleDownloadPDF}
                disabled={downloading || !rcData}
                className="bg-green-600 hover:bg-green-700"
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
            </div>

            <Button
              variant="outline"
              className="w-full bg-transparent"
              onClick={() => router.push(isAuthenticated ? "/dashboard" : "/")}
            >
              <Home className="h-4 w-4 mr-2" />
              {isAuthenticated ? "Back to Dashboard" : "Back to Home"}
            </Button>
          </CardFooter>
        </Card>

        {rcData && (
          <div
            aria-hidden="true"
            className="fixed pointer-events-none"
            style={{ left: "0px", top: "0px", zIndex: -1, width: "1px", height: "1px", overflow: "visible" }}
          >
            <div id="rc-combined-capture" className="inline-flex gap-4 bg-white">
              <RCDocumentTemplate data={rcData} side="front" id="rc-front-capture" />
              <RCDocumentTemplate data={rcData} side="back" id="rc-back-capture" />
            </div>
          </div>
        )}

        {showPreview && rcData && (
          <div className="rounded-xl border bg-white p-4 shadow-sm overflow-x-auto">
            <div className="flex min-w-max justify-center gap-4">
              <RCDocumentTemplate data={rcData} side="front" id="rc-front-preview" />
              <RCDocumentTemplate data={rcData} side="back" id="rc-back-preview" />
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

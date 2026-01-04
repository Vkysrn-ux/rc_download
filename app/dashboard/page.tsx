"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileClock, FileImage, FileText, LogOut, MessageCircle, Plus, Search, Wallet, WalletCards } from "lucide-react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

import { useAuth } from "@/lib/auth-context"
import { formatInr } from "@/lib/format"
import { RCDocumentTemplate } from "@/components/rc-document-template"
import { RcApiProgressChecklist, type RcApiStepStatus } from "@/components/rc-api-progress-checklist"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/\s/g, "")
}

const RC_PREVIEW_WIDTH_PX = 640
const RC_PREVIEW_HEIGHT_PX = 404
const PDF_COMBINED_WIDTH_MM = 320

function RcPreviewCard({ data, side }: { data: any; side: "front" | "back" }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [hostWidth, setHostWidth] = useState<number>(0)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      const next = entry ? Math.max(0, Math.floor(entry.contentRect.width)) : 0
      setHostWidth(next)
    })
    observer.observe(host)

    return () => observer.disconnect()
  }, [])

  const available = hostWidth || 320
  const scale = Math.min(1, available / RC_PREVIEW_WIDTH_PX)
  const scaledW = Math.floor(RC_PREVIEW_WIDTH_PX * scale)
  const scaledH = Math.floor(RC_PREVIEW_HEIGHT_PX * scale)

  return (
    <div ref={hostRef} className="w-full">
      <div className="mx-auto" style={{ width: scaledW, height: scaledH }}>
        <div
          style={{
            width: RC_PREVIEW_WIDTH_PX,
            height: RC_PREVIEW_HEIGHT_PX,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <RCDocumentTemplate data={data} side={side} />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout, refreshUser } = useAuth()
  const waNumber = (process.env.NEXT_PUBLIC_HELPDESK_WHATSAPP_NUMBER || "919677979393").replace(/[^0-9]/g, "")
  const waText = process.env.NEXT_PUBLIC_HELPDESK_WHATSAPP_TEXT || "Hi, I need help with RC Download."
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}` : "/helpdesk"
  const [downloadRegistration, setDownloadRegistration] = useState("")
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [fetchingRc, setFetchingRc] = useState(false)
  const [downloadError, setDownloadError] = useState("")
  const [apiSteps, setApiSteps] = useState<RcApiStepStatus[] | null>(null)
  const [rcData, setRcData] = useState<any | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadType, setDownloadType] = useState<"png" | "pdf" | null>(null)
  const [downloadFileError, setDownloadFileError] = useState("")
  const eventSourceRef = useRef<EventSource | null>(null)
  const isAdmin = user?.role === "admin"

  const resetDownloadCard = () => {
    setRcData(null)
    setApiSteps(null)
    setDownloadError("")
    setDownloadFileError("")
    setAcceptedTerms(false)
    setDownloadRegistration("")
    setFetchingRc(false)
    setDownloading(false)
    setDownloadType(null)
  }

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login")
      return
    }

    if (isAdmin) {
      router.replace("/admin/dashboard")
    }
  }, [isAuthenticated, isAdmin, router])

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!rcData) return

    const timeoutId = window.setTimeout(() => {
      if (downloading) return
      resetDownloadCard()
    }, 30_000)

    return () => window.clearTimeout(timeoutId)
  }, [downloading, rcData, resetDownloadCard])

  if (!isAuthenticated || !user || isAdmin) return null

  const handleLogout = () => {
    void logout().catch(() => {})
    router.push("/")
  }

  const captureCombinedCanvas = async () => {
    const element = document.getElementById("rc-dashboard-capture")
    if (!element) throw new Error("RC capture element not found")
    setDownloadFileError("")
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
        onclone: (doc) => {
          const capture = doc.getElementById("rc-dashboard-capture") as HTMLElement | null
          const wrapper = capture?.parentElement as HTMLElement | null
          if (wrapper) {
            wrapper.style.visibility = "visible"
            wrapper.style.position = "fixed"
            wrapper.style.left = "0"
            wrapper.style.top = "0"
          }
          if (capture) {
            capture.style.visibility = "visible"
          }
        },
      })
    } finally {
      root.setAttribute("style", originalRootStyle)
      body.setAttribute("style", originalBodyStyle)
    }
  }

  const handleDownloadPng = async () => {
    if (!rcData || downloading) return
    setDownloading(true)
    setDownloadType("png")

    try {
      const canvas = await captureCombinedCanvas()
      const link = document.createElement("a")
      link.download = `RC_${normalizeRegistration(String(rcData?.registrationNumber || downloadRegistration || "Combined"))}_Combined.png`
      link.href = canvas.toDataURL("image/png")
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      setDownloadFileError(error instanceof Error ? error.message : "Failed to generate image")
    }

    setDownloading(false)
    setDownloadType(null)
  }

  const handleDownloadPdf = async () => {
    if (!rcData || downloading) return
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
      pdf.save(`RC_${normalizeRegistration(String(rcData?.registrationNumber || downloadRegistration || "Document"))}.pdf`)
    } catch (error) {
      setDownloadFileError(error instanceof Error ? error.message : "Failed to generate PDF")
    }

    setDownloading(false)
    setDownloadType(null)
  }

  const startDownloadFlow = () => {
    const reg = normalizeRegistration(downloadRegistration)
    if (!reg || !acceptedTerms) return

    setDownloadRegistration(reg)
    setDownloadError("")
    setDownloadFileError("")
    setRcData(null)
    setApiSteps(["active", "pending"])
    setFetchingRc(true)

    eventSourceRef.current?.close()
    const source = new EventSource(`/api/rc/lookup/stream?registrationNumber=${encodeURIComponent(reg)}&fresh=1`)
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
      source.close()
      setFetchingRc(false)

      if (!payload?.data) {
        setDownloadError(payload?.paymentRequired ? "Payment required to view RC." : "Lookup failed")
        return
      }

      setRcData(payload.data)
      void refreshUser().catch(() => {})
    })

    source.addEventListener("not_found", (event) => {
      const payload = JSON.parse((event as MessageEvent).data || "{}")
      setDownloadError(payload?.error || "Registration number not found")
      setFetchingRc(false)
      source.close()
    })

    source.addEventListener("server_error", (event) => {
      const payload = JSON.parse((event as MessageEvent).data || "{}")
      setDownloadError(payload?.error || "Lookup failed")
      setFetchingRc(false)
      source.close()
    })

    source.onerror = () => {
      setDownloadError("Lookup failed")
      setFetchingRc(false)
      source.close()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-background">
      <header className="border-b bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <div className="p-2 bg-primary rounded-lg">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold text-foreground">VehicleRCDownload.com</div>
              <div className="text-xs text-muted-foreground">Docx Solutions</div>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-sm hidden sm:block">
              <span className="text-muted-foreground">Welcome, </span>
              <span className="font-semibold">{user.name}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold mb-2">Dashboard</h1>
            <p className="text-sm sm:text-lg text-muted-foreground">Manage your wallet and download RC documents</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="order-2 lg:order-1 border-primary/20 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-green-100 to-green-50 rounded-xl">
                      <Wallet className="h-6 w-6 text-green-600" />
                    </div>
                    <CardTitle className="text-xl sm:text-2xl">Wallet Balance</CardTitle>
                  </div>
                  <Button onClick={() => router.push("/wallet/recharge")} size="lg" className="w-full sm:w-auto">
                    <Plus className="h-5 w-5 mr-2" />
                    Add Money
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
                    <span className="text-4xl sm:text-6xl font-bold text-primary tabular-nums leading-none">
                      {formatInr(user.walletBalance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-sm sm:text-xl text-muted-foreground">available</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                    <span className="text-sm sm:text-base text-blue-900">
                      RC downloads at{" "}
                      <span className="font-bold">{formatInr(20, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} each</span> for
                      registered users
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Downloads available:{" "}
                    <span className="font-bold text-foreground text-base">{Math.floor(user.walletBalance / 20)}</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t space-y-3">
                  <div className="text-sm font-semibold text-foreground">Quick Actions</div>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-11 sm:h-12 text-sm sm:text-base bg-transparent"
                    size="lg"
                    onClick={() => router.push("/transactions?type=download")}
                  >
                    <FileClock className="h-5 w-5 mr-3" />
                    Downloaded History
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-11 sm:h-12 text-sm sm:text-base bg-transparent"
                    size="lg"
                    onClick={() => router.push("/transactions?type=recharge")}
                  >
                    <WalletCards className="h-5 w-5 mr-3" />
                    Wallet Transactions
                  </Button>
                  <Button asChild className="w-full justify-start h-11 sm:h-12 text-sm sm:text-base" size="lg">
                    <a href={waUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-5 w-5 mr-3" />
                      Helpdesk (WhatsApp)
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="order-1 lg:order-2 shadow-md lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-xl">Download RC</CardTitle>
                <CardDescription>Fetch RC details and download instantly</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {downloadError ? <div className="text-sm text-destructive">{downloadError}</div> : null}

                {rcData ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border bg-white p-3">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <RcPreviewCard data={rcData} side="front" />
                        <RcPreviewCard data={rcData} side="back" />
                      </div>
                    </div>

                    {downloadFileError ? <div className="text-sm text-destructive">{downloadFileError}</div> : null}

                    <div className="grid gap-3 sm:grid-cols-3">
                      <Button type="button" size="lg" onClick={handleDownloadPng} disabled={downloading}>
                        <FileImage className="h-5 w-5 mr-2" />
                        {downloading && downloadType === "png" ? "Generating..." : "Download PNG"}
                      </Button>
                      <Button type="button" size="lg" onClick={handleDownloadPdf} disabled={downloading}>
                        <FileText className="h-5 w-5 mr-2" />
                        {downloading && downloadType === "pdf" ? "Generating..." : "Download PDF"}
                      </Button>
                      <Button type="button" variant="outline" className="bg-transparent" size="lg" onClick={resetDownloadCard} disabled={downloading}>
                        New Search
                      </Button>
                    </div>

                    <div
                      aria-hidden="true"
                      className="pointer-events-none"
                      style={{
                        position: "fixed",
                        left: 0,
                        top: 0,
                        visibility: "hidden",
                      }}
                    >
                      <div id="rc-dashboard-capture" className="inline-flex gap-4 bg-white p-4">
                        <RCDocumentTemplate data={rcData} side="front" id="rc-front-dashboard-capture" />
                        <RCDocumentTemplate data={rcData} side="back" id="rc-back-dashboard-capture" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="dashboard-registration" className="sr-only">
                        Registration Number
                      </Label>
                      <Input
                        id="dashboard-registration"
                        type="text"
                        placeholder="ENTER VEHICLE NUMBER (E.G., MH12AB1234)"
                        value={downloadRegistration}
                        onChange={(e) => setDownloadRegistration(e.target.value.toUpperCase())}
                        className="h-11 text-center font-mono tracking-widest"
                        autoComplete="off"
                        inputMode="text"
                      />
                    </div>

                    <div className="rounded-xl border bg-white p-3">
                      <div className="flex items-start gap-3">
                          <Checkbox
                          id="dashboard-terms"
                          checked={acceptedTerms}
                          onCheckedChange={(value) => setAcceptedTerms(value === true)}
                          disabled={fetchingRc}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="dashboard-terms" className="font-normal leading-relaxed">
                            I agree to the Terms & Conditions.
                          </Label>
                          <p className="text-xs text-muted-foreground">This is virtual RC only for references not original.</p>
                          <Link href="/terms" className="text-xs underline text-muted-foreground">
                            View Terms
                          </Link>
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full justify-start h-11 sm:h-12 text-sm sm:text-base"
                      size="lg"
                      onClick={startDownloadFlow}
                      disabled={!downloadRegistration || !acceptedTerms || fetchingRc}
                    >
                      <Search className="h-5 w-5 mr-3" />
                      {fetchingRc ? "Fetching..." : "Fetch RC Details"}
                    </Button>

                    {(fetchingRc || apiSteps) && <RcApiProgressChecklist active={fetchingRc} steps={apiSteps} />}

                    <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                      Wallet users are charged only after a successful RC fetch.
                    </div>
                  </>
                )}

              </CardContent>
            </Card>
          </div>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">How to Use</CardTitle>
              <CardDescription className="text-sm sm:text-base">Follow these simple steps to download your RC documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg">
                    1
                  </div>
                  <h3 className="font-bold text-lg">Add Money to Wallet</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    Recharge your wallet using Razorpay for secure and convenient transactions
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg">
                    2
                  </div>
                  <h3 className="font-bold text-lg">Enter Vehicle Details</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    Provide your vehicle registration number to fetch RC details from the database
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg">
                    3
                  </div>
                  <h3 className="font-bold text-lg">Download Instantly</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    Get your RC document as a PDF immediately after successful payment
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

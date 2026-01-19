"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, FileClock, FileImage, FileText, IdCard, LogOut, MessageCircle, Plus, Search, Smartphone, Wallet, WalletCards, Zap } from "lucide-react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

import { useAuth } from "@/lib/auth-context"
import { formatInr } from "@/lib/format"
import {
  REGISTERED_PAN_DETAILS_PRICE_INR,
  REGISTERED_RC_DOWNLOAD_PRICE_INR,
  REGISTERED_RC_OWNER_HISTORY_PRICE_INR,
  REGISTERED_RC_TO_MOBILE_PRICE_INR,
} from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { canvasToPdfImage, getClientPdfSettings } from "@/lib/pdf-client"
import { RCDocumentTemplate } from "@/components/rc-document-template"
import { RCDocumentPairPreview } from "@/components/rc-document-pair"
import VirtualRcTemplate from "@/components/virtual-rc"
import { RcApiProgressChecklist, type RcApiStepStatus } from "@/components/rc-api-progress-checklist"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/\s/g, "")
}

const PDF_COMBINED_WIDTH_MM = 320

type DashboardServiceId = "rc_download" | "pan_details" | "rc_to_mobile" | "rc_owner_history"

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout, refreshUser } = useAuth()
  const waDigits = (process.env.NEXT_PUBLIC_HELPDESK_WHATSAPP_NUMBER || "9344759416").replace(/[^0-9]/g, "")
  const waNumber = waDigits.length === 10 ? `91${waDigits}` : waDigits
  const waText = process.env.NEXT_PUBLIC_HELPDESK_WHATSAPP_TEXT || "Hi, I need help with RC Download."
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}` : "/helpdesk"
  const [walletOpen, setWalletOpen] = useState(false)
  const [activeService, setActiveService] = useState<DashboardServiceId>("rc_download")
  const [mobileOpenServiceId, setMobileOpenServiceId] = useState<DashboardServiceId | null>("rc_download")
  const servicePanelRef = useRef<HTMLDivElement | null>(null)
  const [downloadRegistration, setDownloadRegistration] = useState("")
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [fetchingRc, setFetchingRc] = useState(false)
  const [downloadError, setDownloadError] = useState("")
  const [apiSteps, setApiSteps] = useState<RcApiStepStatus[] | null>(null)
  const [rcData, setRcData] = useState<any | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadType, setDownloadType] = useState<"png" | "pdf" | null>(null)
  const [downloadFileError, setDownloadFileError] = useState("")
  const [resultView, setResultView] = useState<"documents" | "mparivahan">("documents")
  const [panLookup, setPanLookup] = useState("")
  const [panLoading, setPanLoading] = useState(false)
  const [panError, setPanError] = useState("")
  const [panData, setPanData] = useState<any | null>(null)
  const [panFetched, setPanFetched] = useState("")
  const [rcToMobileLookup, setRcToMobileLookup] = useState("")
  const [ownerHistoryLookup, setOwnerHistoryLookup] = useState("")
  const [rcToMobileLoading, setRcToMobileLoading] = useState(false)
  const [rcToMobileError, setRcToMobileError] = useState("")
  const [rcToMobileData, setRcToMobileData] = useState<any | null>(null)
  const [rcToMobileFetchedReg, setRcToMobileFetchedReg] = useState("")
  const [ownerHistoryLoading, setOwnerHistoryLoading] = useState(false)
  const [ownerHistoryError, setOwnerHistoryError] = useState("")
  const [ownerHistoryData, setOwnerHistoryData] = useState<any | null>(null)
  const [ownerHistoryFetchedReg, setOwnerHistoryFetchedReg] = useState("")
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
    setResultView("documents")
  }

  const resetOwnerHistoryCard = () => {
    setOwnerHistoryLookup("")
    setOwnerHistoryError("")
    setOwnerHistoryData(null)
    setOwnerHistoryFetchedReg("")
    setOwnerHistoryLoading(false)
  }

  const resetPanCard = () => {
    setPanLookup("")
    setPanError("")
    setPanData(null)
    setPanFetched("")
    setPanLoading(false)
  }

  const resetRcToMobileCard = () => {
    setRcToMobileLookup("")
    setRcToMobileError("")
    setRcToMobileData(null)
    setRcToMobileFetchedReg("")
    setRcToMobileLoading(false)
  }

  const fetchRcToMobile = async () => {
    const reg = normalizeRegistration(rcToMobileLookup)
    if (!reg || rcToMobileLoading) return
    setRcToMobileError("")
    setRcToMobileData(null)
    setRcToMobileLoading(true)

    try {
      const res = await fetch(`/api/rc/to-mobile?registrationNumber=${encodeURIComponent(reg)}`, { method: "GET" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "RC-to-mobile lookup failed")
      }
      setRcToMobileData(json?.data ?? null)
      setRcToMobileFetchedReg(reg)
      setRcToMobileLookup(reg)
      void refreshUser().catch(() => {})
    } catch (e: any) {
      setRcToMobileError(e?.message || "RC-to-mobile lookup failed")
    } finally {
      setRcToMobileLoading(false)
    }
  }

  const fetchPanDetails = async () => {
    const pan = normalizeRegistration(panLookup)
    if (!pan || panLoading) return
    setPanError("")
    setPanData(null)
    setPanLoading(true)

    try {
      const res = await fetch(`/api/pan/details?panNumber=${encodeURIComponent(pan)}`, { method: "GET" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "PAN lookup failed")
      }
      setPanData(json?.data ?? null)
      setPanFetched(pan)
      setPanLookup(pan)
      void refreshUser().catch(() => {})
    } catch (e: any) {
      setPanError(e?.message || "PAN lookup failed")
    } finally {
      setPanLoading(false)
    }
  }

  const fetchOwnerHistory = async () => {
    const reg = normalizeRegistration(ownerHistoryLookup)
    if (!reg || ownerHistoryLoading) return
    setOwnerHistoryError("")
    setOwnerHistoryData(null)
    setOwnerHistoryLoading(true)

    try {
      const res = await fetch(`/api/rc/owner-history?registrationNumber=${encodeURIComponent(reg)}`, { method: "GET" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Owner history lookup failed")
      }
      setOwnerHistoryData(json?.data ?? null)
      setOwnerHistoryFetchedReg(reg)
      setOwnerHistoryLookup(reg)
      void refreshUser().catch(() => {})
    } catch (e: any) {
      setOwnerHistoryError(e?.message || "Owner history lookup failed")
    } finally {
      setOwnerHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (!ownerHistoryData) return

    const timeoutId = window.setTimeout(() => {
      resetOwnerHistoryCard()
    }, 30_000)

    return () => window.clearTimeout(timeoutId)
  }, [ownerHistoryData])

  useEffect(() => {
    if (!panData) return

    const timeoutId = window.setTimeout(() => {
      resetPanCard()
    }, 30_000)

    return () => window.clearTimeout(timeoutId)
  }, [panData])

  useEffect(() => {
    if (!rcToMobileData) return

    const timeoutId = window.setTimeout(() => {
      resetRcToMobileCard()
    }, 30_000)

    return () => window.clearTimeout(timeoutId)
  }, [rcToMobileData])

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

  const captureCombinedCanvas = async (scale = 2) => {
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
        scale,
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
      pdf.save(`RC_${normalizeRegistration(String(rcData?.registrationNumber || downloadRegistration || "Document"))}.pdf`)
    } catch (error) {
      setDownloadFileError(error instanceof Error ? error.message : "Failed to generate PDF")
    }

    setDownloading(false)
    setDownloadType(null)
  }

  const captureElementCanvas = async (elementId: string, scale = 2) => {
    const element = document.getElementById(elementId)
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
              if ((img as HTMLImageElement).complete) return resolve()
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
    body.style.backgroundColor = "#ffffff"
    try {
      return await html2canvas(element, { scale, backgroundColor: "#ffffff", useCORS: true, scrollX: 0, scrollY: 0 })
    } finally {
      root.setAttribute("style", originalRootStyle)
      body.setAttribute("style", originalBodyStyle)
    }
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
            <Dialog open={walletOpen} onOpenChange={setWalletOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border bg-white/80 px-3 py-2 text-sm hover:bg-muted/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Wallet"
                >
                  <span className="relative">
                    <Wallet className="h-4 w-4" />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Plus className="h-3 w-3" />
                    </span>
                  </span>
                  <span className="hidden sm:inline font-semibold tabular-nums">
                    {formatInr(user.walletBalance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Wallet</DialogTitle>
                  <DialogDescription>Balance and quick actions</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="rounded-lg border p-4 bg-muted/20">
                    <div className="text-sm text-muted-foreground">Available balance</div>
                    <div className="text-3xl font-bold tabular-nums">
                      {formatInr(user.walletBalance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      RC downloads at{" "}
                      <span className="font-semibold text-foreground">
                        {formatInr(REGISTERED_RC_DOWNLOAD_PRICE_INR, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{" "}
                        each
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Downloads available:{" "}
                      <span className="font-semibold text-foreground">
                        {Math.floor(user.walletBalance / REGISTERED_RC_DOWNLOAD_PRICE_INR)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Button onClick={() => router.push("/wallet/recharge")} className="w-full justify-start">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Money
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push("/transactions?type=recharge")}
                      className="w-full justify-start"
                    >
                      <WalletCards className="h-4 w-4 mr-2" />
                      Wallet Transactions
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push("/transactions?type=download")}
                      className="w-full justify-start"
                    >
                      <FileClock className="h-4 w-4 mr-2" />
                      Downloaded History
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

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

          <div className="grid gap-4 lg:hidden">
            {[
              {
                id: "rc_download" as const,
                title: "RC Download",
                subtitle: `${formatInr(REGISTERED_RC_DOWNLOAD_PRICE_INR, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} via wallet`,
                icon: Zap,
                iconClassName: "bg-blue-50 text-primary",
              },
              {
                id: "pan_details" as const,
                title: "PAN Details",
                subtitle: `${formatInr(REGISTERED_PAN_DETAILS_PRICE_INR, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} via wallet`,
                icon: IdCard,
                iconClassName: "bg-emerald-50 text-emerald-700",
              },
              {
                id: "rc_to_mobile" as const,
                title: "RC to Mobile Number",
                subtitle: `${formatInr(REGISTERED_RC_TO_MOBILE_PRICE_INR, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} via wallet`,
                icon: Smartphone,
                iconClassName: "bg-emerald-50 text-emerald-700",
              },
              {
                id: "rc_owner_history" as const,
                title: "RC Owner History",
                subtitle: `${formatInr(REGISTERED_RC_OWNER_HISTORY_PRICE_INR, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} via wallet`,
                icon: FileClock,
                iconClassName: "bg-purple-50 text-purple-700",
              },
            ].map((service) => {
              const Icon = service.icon
              const isOpen = mobileOpenServiceId === service.id
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    if (isOpen) {
                      setMobileOpenServiceId(null)
                      return
                    }
                    setActiveService(service.id)
                    setMobileOpenServiceId(service.id)
                    requestAnimationFrame(() => servicePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
                  }}
                  className={cn(
                    "w-full rounded-xl border-2 bg-white text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isOpen ? "border-primary/60 shadow-sm" : "border-primary/20 hover:border-primary/40",
                  )}
                >
                  <div className="px-4 py-4 flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg shrink-0", service.iconClassName)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold leading-tight break-words whitespace-normal">{service.title}</div>
                          <div className="text-xs text-muted-foreground break-words whitespace-normal">{service.subtitle}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="text-[10px] text-muted-foreground hidden sm:block">
                            {isOpen ? "Click to Collapse" : "Click to Expand"}
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform",
                              isOpen ? "rotate-180" : "",
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="order-1 lg:order-1 border-primary/20 shadow-md hidden lg:block">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl">Services</CardTitle>
                <CardDescription>Select a service to continue</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  {
                    id: "rc_download" as const,
                    title: "RC Download",
                    subtitle: `${formatInr(REGISTERED_RC_DOWNLOAD_PRICE_INR, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} via wallet`,
                    icon: Zap,
                    iconClassName: "bg-blue-50 text-primary",
                  },
                  {
                    id: "pan_details" as const,
                    title: "PAN Details",
                    subtitle: `${formatInr(REGISTERED_PAN_DETAILS_PRICE_INR, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} via wallet`,
                    icon: IdCard,
                    iconClassName: "bg-emerald-50 text-emerald-700",
                  },
                  {
                    id: "rc_to_mobile" as const,
                    title: "RC to Mobile Number",
                    subtitle: `${formatInr(REGISTERED_RC_TO_MOBILE_PRICE_INR, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} via wallet`,
                    icon: Smartphone,
                    iconClassName: "bg-emerald-50 text-emerald-700",
                  },
                  {
                    id: "rc_owner_history" as const,
                    title: "RC Owner History",
                    subtitle: `${formatInr(REGISTERED_RC_OWNER_HISTORY_PRICE_INR, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} via wallet`,
                    icon: FileClock,
                    iconClassName: "bg-purple-50 text-purple-700",
                  },
                ].map((service) => {
                  const Icon = service.icon
                  const active = activeService === service.id

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        if (service.id === activeService) return
                        setActiveService(service.id)
                        resetDownloadCard()
                        resetPanCard()
                        resetRcToMobileCard()
                        resetOwnerHistoryCard()
                      }}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "border-primary/60 bg-blue-50/30" : "border-border bg-white",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg shrink-0", service.iconClassName)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold leading-tight break-words whitespace-normal">{service.title}</div>
                          <div className="text-xs text-muted-foreground break-words whitespace-normal">{service.subtitle}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}

                <div className="pt-3">
                  <Button asChild className="w-full justify-start h-11 sm:h-12 text-sm sm:text-base" size="lg">
                    <a href={waUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-5 w-5 mr-3" />
                      Helpdesk (WhatsApp)
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div
              ref={servicePanelRef}
              className={cn(mobileOpenServiceId ? "" : "hidden", "lg:block lg:col-span-2 order-2 lg:order-2")}
            >
            {activeService === "rc_download" ? (
              <Card className="order-2 lg:order-2 shadow-md lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-xl">Download RC</CardTitle>
                  <CardDescription>Fetch RC details and download instantly</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {downloadError ? <div className="text-sm text-destructive">{downloadError}</div> : null}

                {rcData ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border bg-white p-3">
                      {resultView === "mparivahan" ? (
                        <div className="flex justify-center">
                          <div className="overflow-x-auto">
                            <VirtualRcTemplate
                              data={rcData}
                              id="rc-virtual-preview-dashboard-full"
                              showReturnButton
                              returnHref="/"
                              returnLabel="Return to Home"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                        <div className="w-full overflow-hidden">
                          <RCDocumentPairPreview data={rcData} />
                        </div>
                        </>
                      )}
                    </div>

                    {downloadFileError ? <div className="text-sm text-destructive">{downloadFileError}</div> : null}

                    <div className="grid gap-3 sm:grid-cols-4">
                      <Button type="button" size="lg" onClick={handleDownloadPng} disabled={downloading}>
                        <FileImage className="h-5 w-5 mr-2" />
                        {downloading && downloadType === "png" ? "Generating..." : "Download PNG"}
                      </Button>
                      <Button type="button" size="lg" onClick={handleDownloadPdf} disabled={downloading}>
                        <FileText className="h-5 w-5 mr-2" />
                        {downloading && downloadType === "pdf" ? "Generating..." : "Download PDF"}
                      </Button>
                      <Button
                        type="button"
                        variant={resultView === "mparivahan" ? "default" : "outline"}
                        className={resultView === "mparivahan" ? "" : "bg-transparent"}
                        size="lg"
                        onClick={() => setResultView((prev) => (prev === "mparivahan" ? "documents" : "mparivahan"))}
                        disabled={downloading}
                      >
                        <Smartphone className="h-5 w-5 mr-2" />
                        {resultView === "mparivahan" ? "Show Documents" : "mParivahan"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-transparent"
                        size="lg"
                        onClick={resetDownloadCard}
                        disabled={downloading}
                      >
                        New Search
                      </Button>
                    </div>

                    <div aria-hidden="true" className="pointer-events-none" style={{ position: "fixed", left: 0, top: 0, visibility: "hidden" }}>
                      <div id="rc-dashboard-capture" className="inline-flex bg-white">
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
            ) : activeService === "pan_details" ? (
              <Card className="order-2 lg:order-2 shadow-md lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-xl">PAN Details</CardTitle>
                  <CardDescription>Fetch PAN holder details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dashboard-pan" className="text-sm font-medium">
                      PAN Number
                    </Label>
                    <Input
                      id="dashboard-pan"
                      type="text"
                      placeholder="ABCDE1234F"
                      value={panLookup}
                      onChange={(e) => {
                        if (panData) return
                        setPanLookup(e.target.value.toUpperCase())
                      }}
                      className="h-11 text-center font-mono tracking-widest"
                      autoComplete="off"
                      inputMode="text"
                      disabled={panLoading || Boolean(panData)}
                    />
                  </div>

                  {panError ? <div className="text-sm text-destructive">{panError}</div> : null}

                  {panData ? (
                    <Button className="w-full h-11 sm:h-12" size="lg" variant="outline" onClick={resetPanCard}>
                      Clear
                    </Button>
                  ) : (
                    <Button
                      className="w-full h-11 sm:h-12"
                      size="lg"
                      onClick={fetchPanDetails}
                      disabled={!panLookup || panLoading || (Boolean(panFetched) && panFetched === normalizeRegistration(panLookup))}
                    >
                      {panLoading
                        ? "Fetching..."
                        : `Fetch PAN Details (${formatInr(REGISTERED_PAN_DETAILS_PRICE_INR, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`}
                    </Button>
                  )}

                  {panData ? (
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-sm font-semibold mb-2">Result</div>
                      {(() => {
                        const root = panData as any
                        const core = root?.data ?? root?.result ?? root?.response ?? root ?? {}
                        const formatValue = (value: unknown): string => {
                          if (value === null || value === undefined) return ""
                          if (typeof value === "string") return value.trim()
                          if (typeof value === "number" || typeof value === "boolean") return String(value)
                          if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(", ")
                          if (typeof value === "object") {
                            const obj = value as Record<string, unknown>
                            const addressKeys = [
                              "house",
                              "house_no",
                              "houseNo",
                              "door_no",
                              "doorNo",
                              "building",
                              "street",
                              "locality",
                              "area",
                              "landmark",
                              "city",
                              "district",
                              "state",
                              "pincode",
                              "pin_code",
                              "postal_code",
                              "country",
                            ]
                            const parts = addressKeys.map((k) => formatValue(obj[k])).filter(Boolean)
                            if (parts.length) return parts.join(", ")
                            try {
                              return JSON.stringify(obj)
                            } catch {
                              return ""
                            }
                          }
                          return ""
                        }

                        const deepFindString = (value: unknown, keyMatchers: Array<(key: string) => boolean>): string => {
                          const seen = new Set<unknown>()
                          const walk = (node: unknown): string => {
                            if (!node || typeof node !== "object") return ""
                            if (seen.has(node)) return ""
                            seen.add(node)
                            if (Array.isArray(node)) {
                              for (const item of node) {
                                const found = walk(item)
                                if (found) return found
                              }
                              return ""
                            }
                            const obj = node as Record<string, unknown>
                            for (const [key, entry] of Object.entries(obj)) {
                              if (keyMatchers.some((m) => m(key))) {
                                const val = formatValue(entry)
                                if (val) return val
                              }
                            }
                            for (const entry of Object.values(obj)) {
                              const found = walk(entry)
                              if (found) return found
                            }
                            return ""
                          }
                          return walk(value)
                        }
                        const formatDate = (value: string) => {
                          const text = (value || "").trim()
                          if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                            const [yyyy, mm, dd] = text.split("-")
                            return `${dd}-${mm}-${yyyy}`
                          }
                          return text
                        }

                        const nameProvided = ""
                        const pan = formatValue(core?.pan_number ?? core?.panNumber ?? core?.pan ?? panLookup)

                        const firstName = formatValue(core?.first_name ?? core?.firstName)
                        const lastName = formatValue(core?.last_name ?? core?.lastName)
                        const registeredName = formatValue(core?.registered_name ?? core?.registeredName ?? core?.full_name ?? core?.fullName)
                        const panType = formatValue(core?.pan_type ?? core?.panType ?? core?.type)
                        const gender = formatValue(core?.gender)
                        const dob = formatDate(formatValue(core?.date_of_birth ?? core?.dateOfBirth ?? core?.dob))
                        const maskedAadhaar =
                          formatValue(
                            core?.masked_aadhaar ??
                              core?.maskedAadhaar ??
                              core?.masked_aadhaar_number ??
                              core?.maskedAadhaarNumber ??
                              core?.masked_aadhar ??
                              core?.maskedAadhar ??
                              core?.masked_aadhar_number ??
                              core?.maskedAadharNumber ??
                              core?.aadhaar_masked ??
                              core?.aadhaarMasked ??
                              core?.aadhar_masked ??
                              core?.aadharMasked,
                          ) ||
                          deepFindString(core, [
                            (k) => k.toLowerCase().includes("masked_aadhaar"),
                            (k) => k.toLowerCase().includes("masked_aadhar"),
                            (k) => k.toLowerCase().includes("aadhaar") && k.toLowerCase().includes("masked"),
                            (k) => k.toLowerCase().includes("aadhar") && k.toLowerCase().includes("masked"),
                          ])
                        const email = formatValue(core?.email ?? core?.email_id ?? core?.emailId)
                        const mobile = formatValue(core?.mobile_number ?? core?.mobileNumber ?? core?.mobile ?? core?.phone ?? core?.phone_number ?? core?.phoneNumber)

                        const aadhaarLinkRaw = core?.aadhaar_link ?? core?.aadhaarLink ?? core?.aadhaar_linked ?? core?.aadhaarLinked
                        const aadhaarLink =
                          typeof aadhaarLinkRaw === "boolean"
                            ? aadhaarLinkRaw
                              ? "True"
                              : "False"
                      : formatValue(aadhaarLinkRaw)

                        const address = formatValue(core?.address ?? core?.full_address ?? core?.fullAddress)
                        const panRefId = formatValue(
                          core?.pan_ref_id ??
                            core?.panRefId ??
                            core?.reference_id ??
                            core?.referenceId ??
                            core?.verification_id ??
                            core?.verificationId,
                        )
                        const status = formatValue(core?.status ?? core?.pan_status ?? core?.panStatus ?? core?.message_code ?? core?.messageCode)
                        const message = formatValue(core?.message ?? core?.result_message ?? core?.resultMessage ?? core?.remarks)
                        const nameOnCard = formatValue(
                          core?.name_on_pan_card ?? core?.nameOnPanCard ?? core?.name_pan_card ?? core?.namePanCard,
                        )

                        const items: Array<{ label: string; value: string }> = [
                          { label: "Name Pan Card", value: nameOnCard || "-" },
                          { label: "PAN", value: pan || "-" },
                          { label: "First Name", value: firstName || "-" },
                          { label: "Last Name", value: lastName || "-" },
                          { label: "Registered Name", value: registeredName || "-" },
                          { label: "PAN Type", value: panType || "-" },
                          { label: "Gender", value: gender || "-" },
                          { label: "Date of Birth", value: dob || "-" },
                          { label: "Masked Aadhaar", value: maskedAadhaar || "-" },
                          { label: "Email", value: email || "-" },
                          { label: "Mobile number", value: mobile || "-" },
                          { label: "Aadhaar Link", value: aadhaarLink || "-" },
                          { label: "Address", value: address || "-" },
                          { label: "PAN Ref. ID", value: panRefId || "-" },
                          { label: "Status", value: status || "-" },
                          { label: "Message", value: message || "-" },
                        ]

                        return (
                          <div className="grid gap-x-10 gap-y-2 sm:grid-cols-2">
                            {items.map((item) => (
                              <div
                                key={item.label}
                                className="flex items-start justify-between gap-6 border-b border-border/60 py-2"
                              >
                                <div className="text-sm text-muted-foreground shrink-0">{item.label}</div>
                                <div className="text-sm font-semibold text-right break-words whitespace-normal min-w-0">
                                  {item.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : activeService === "rc_to_mobile" ? (
              <Card className="order-2 lg:order-2 shadow-md lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-xl">RC to Mobile Number</CardTitle>
                  <CardDescription>Find linked mobile number</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dashboard-rc-to-mobile" className="text-sm font-medium">
                      Vehicle Registration Number
                    </Label>
                    <Input
                      id="dashboard-rc-to-mobile"
                      type="text"
                      placeholder="MH12AB1234"
                      value={rcToMobileLookup}
                      onChange={(e) => {
                        if (rcToMobileData) return
                        setRcToMobileLookup(e.target.value.toUpperCase())
                      }}
                      className="h-11 text-center font-mono tracking-widest"
                      autoComplete="off"
                      inputMode="text"
                      disabled={rcToMobileLoading || Boolean(rcToMobileData)}
                    />
                  </div>

                  {rcToMobileError ? <div className="text-sm text-destructive">{rcToMobileError}</div> : null}

                  {rcToMobileData ? (
                    <Button className="w-full h-11 sm:h-12" size="lg" variant="outline" onClick={resetRcToMobileCard}>
                      Clear
                    </Button>
                  ) : (
                    <Button
                      className="w-full h-11 sm:h-12"
                      size="lg"
                      onClick={fetchRcToMobile}
                      disabled={!rcToMobileLookup || rcToMobileLoading || (Boolean(rcToMobileFetchedReg) && rcToMobileFetchedReg === normalizeRegistration(rcToMobileLookup))}
                    >
                      {rcToMobileLoading
                        ? "Fetching..."
                        : `Fetch Mobile (${formatInr(REGISTERED_RC_TO_MOBILE_PRICE_INR, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`}
                    </Button>
                  )}

                  {rcToMobileData ? (
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-sm font-semibold mb-2">Result</div>
                      {(() => {
                        const root = rcToMobileData as any
                        const core = root?.data ?? root?.result ?? root?.response ?? root ?? {}
                        const rcNumber = String(core?.rc_number ?? core?.rcNumber ?? core?.registration_number ?? core?.registrationNumber ?? rcToMobileLookup ?? "")
                        const mobile =
                          String(
                            core?.mobile_number ??
                              core?.mobileNumber ??
                              core?.mobile ??
                              core?.phone ??
                              core?.phone_number ??
                              core?.phoneNumber ??
                              core?.linked_mobile ??
                              core?.linkedMobile ??
                              "",
                          ) || "-"

                        const items: Array<{ label: string; value: string }> = [
                          { label: "RC Number", value: rcNumber || "-" },
                          { label: "Mobile Number", value: mobile },
                        ]

                        return (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {items.map((item) => (
                              <div key={item.label} className="rounded-md border bg-white p-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {item.label}
                                </div>
                                <div className="mt-1 text-sm font-semibold break-words whitespace-normal">{item.value}</div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <Card className="order-2 lg:order-2 shadow-md lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-xl">RC Owner History</CardTitle>
                  <CardDescription>Fetch owner transfer & history report</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dashboard-owner-history" className="text-sm font-medium">
                      Vehicle Registration Number
                    </Label>
                    <Input
                      id="dashboard-owner-history"
                      type="text"
                      placeholder="MH12AB1234"
                      value={ownerHistoryLookup}
                      onChange={(e) => {
                        if (ownerHistoryData) return
                        setOwnerHistoryLookup(e.target.value.toUpperCase())
                      }}
                      className="h-11 text-center font-mono tracking-widest"
                      autoComplete="off"
                      inputMode="text"
                      disabled={ownerHistoryLoading || Boolean(ownerHistoryData)}
                    />
                  </div>

                  {ownerHistoryError ? <div className="text-sm text-destructive">{ownerHistoryError}</div> : null}

                  {ownerHistoryData ? (
                    <Button className="w-full h-11 sm:h-12" size="lg" variant="outline" onClick={resetOwnerHistoryCard}>
                      Clear
                    </Button>
                  ) : (
                    <Button
                      className="w-full h-11 sm:h-12"
                      size="lg"
                      onClick={fetchOwnerHistory}
                      disabled={!ownerHistoryLookup || ownerHistoryLoading || (Boolean(ownerHistoryFetchedReg) && ownerHistoryFetchedReg === normalizeRegistration(ownerHistoryLookup))}
                    >
                      {ownerHistoryLoading
                        ? "Fetching..."
                        : `Fetch Owner History (${formatInr(REGISTERED_RC_OWNER_HISTORY_PRICE_INR, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`}
                    </Button>
                  )}

                  {ownerHistoryData ? (
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-sm font-semibold mb-2">Result</div>
                      {(() => {
                        const root = ownerHistoryData as any
                        const core = root?.data ?? root?.result ?? root?.response ?? root ?? {}
                        const history = Array.isArray(core?.owner_history) ? core.owner_history : []
                        const firstHistory = history[0] ?? {}
                        const rcNumber = String(core?.rc_number ?? core?.rcNumber ?? core?.registration_number ?? core?.registrationNumber ?? "")
                        const currentOwnerName = String(core?.current_owner_name ?? core?.currentOwnerName ?? "")
                        const currentOwnerNumber = String(core?.current_owner_number ?? core?.currentOwnerNumber ?? "")
                        const ownerName = String(firstHistory?.owner_name ?? firstHistory?.ownerName ?? "")
                        const ownerNumber = String(firstHistory?.owner_number ?? firstHistory?.ownerNumber ?? "")

                        const items: Array<{ label: string; value: string }> = [
                          { label: "RC Number", value: rcNumber || "-" },
                          { label: "Current Owner Name", value: currentOwnerName || "-" },
                          { label: "Owner Name", value: ownerName || "-" },
                          { label: "Owner Number", value: ownerNumber || "-" },
                        ]

                        return (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {items.map((item) => (
                              <div key={item.label} className="rounded-md border bg-white p-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {item.label}
                                </div>
                                <div className="mt-1 text-sm font-semibold break-words whitespace-normal">{item.value}</div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
            </div>
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
                    Recharge your wallet to pay for downloads (payment integration is being upgraded)
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

"use client"

import type { ComponentType } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, FileClock, IdCard, Smartphone, Zap } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { formatInr } from "@/lib/format"
import {
  getPanDetailsPriceInr,
  getRcOwnerHistoryPriceInr,
  getRcToMobilePriceInr,
  GUEST_RC_DOWNLOAD_PRICE_INR,
  REGISTERED_RC_DOWNLOAD_PRICE_INR,
} from "@/lib/pricing"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ServiceId = "rc_download" | "pan_details" | "rc_to_mobile" | "rc_owner_history"

type Service = {
  id: ServiceId
  title: string
  subtitle: string
  priceCaption: string
  icon: ComponentType<{ className?: string }>
  iconClassName: string
}

type ServiceCatalogProps = {
  rcRegistration?: string
  rcWhatsapp?: string
  rcResult?: string | null
  onRcRegistrationChange?: (value: string) => void
  onRcWhatsappChange?: (value: string) => void
  onRcPay?: () => void
}

function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/\s/g, "")
}

export default function ServiceCatalog({
  rcRegistration: rcRegistrationProp,
  rcWhatsapp: rcWhatsappProp,
  rcResult: rcResultProp,
  onRcRegistrationChange,
  onRcWhatsappChange,
  onRcPay,
}: ServiceCatalogProps) {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  const defaultGuestPhone = useMemo(() => {
    const raw =
      (process.env.NEXT_PUBLIC_HELPDESK_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER || "").trim()
    const digits = raw.replace(/\D/g, "")
    if (digits.length === 10) return `+91${digits}`
    if (digits.length >= 10 && digits.length <= 15) return `+${digits}`
    return "+91"
  }, [])

  const rcGuestPrice = GUEST_RC_DOWNLOAD_PRICE_INR
  const rcRegisteredPrice = REGISTERED_RC_DOWNLOAD_PRICE_INR
  const rcDisplayPrice = isAuthenticated ? rcRegisteredPrice : rcGuestPrice

  const panDisplayPrice = getPanDetailsPriceInr(!isAuthenticated)
  const rcToMobileRegisteredPrice = getRcToMobilePriceInr(false)
  const rcToMobileDisplayPrice = getRcToMobilePriceInr(!isAuthenticated)
  const ownerHistoryRegisteredPrice = getRcOwnerHistoryPriceInr(false)
  const ownerHistoryDisplayPrice = getRcOwnerHistoryPriceInr(!isAuthenticated)

  const formatPrice = (value: number) => formatInr(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const rcDisplayPriceText = formatPrice(rcDisplayPrice)
  const rcRegisteredPriceText = formatPrice(rcRegisteredPrice)
  const panDisplayPriceText = formatPrice(panDisplayPrice)
  const rcToMobileDisplayPriceText = formatPrice(rcToMobileDisplayPrice)
  const rcToMobileRegisteredPriceText = formatPrice(rcToMobileRegisteredPrice)
  const ownerHistoryDisplayPriceText = formatPrice(ownerHistoryDisplayPrice)
  const ownerHistoryRegisteredPriceText = formatPrice(ownerHistoryRegisteredPrice)

  const services = useMemo<Service[]>(
    () => [
      {
        id: "rc_download",
        title: "RC Download",
        subtitle: "Quick one-time download",
        priceCaption: `₹${rcDisplayPrice} per download`,
        icon: Zap,
        iconClassName: "bg-blue-50 text-primary",
      },
      {
        id: "pan_details",
        title: "PAN Details",
        subtitle: "Lookup PAN information",
        priceCaption: `₹${panDisplayPrice} per PAN data`,
        icon: IdCard,
        iconClassName: "bg-emerald-50 text-emerald-700",
      },
      {
        id: "rc_to_mobile",
        title: "RC to Mobile Number",
        subtitle: "Find linked mobile number",
        priceCaption: `₹${rcToMobileDisplayPrice} per Mobile`,
        icon: Smartphone,
        iconClassName: "bg-emerald-50 text-emerald-700",
      },
      {
        id: "rc_owner_history",
        title: "RC Owner History",
        subtitle: "Owner transfer & history report",
        priceCaption: `₹${ownerHistoryDisplayPrice} per report`,
        icon: FileClock,
        iconClassName: "bg-purple-50 text-purple-700",
      },
    ],
    [rcDisplayPrice, panDisplayPrice, rcToMobileDisplayPrice, ownerHistoryDisplayPrice],
  )

  const [openServiceId, setOpenServiceId] = useState<ServiceId | null>("rc_download")

  const [rcRegistrationInternal, setRcRegistrationInternal] = useState("")
  const [rcWhatsappInternal, setRcWhatsappInternal] = useState("+91")
  const [rcResultInternal, setRcResultInternal] = useState<string | null>(null)

  const guestPhone = defaultGuestPhone
  const [rcToMobileRegistration, setRcToMobileRegistration] = useState("")
  const [rcToMobileLoading, setRcToMobileLoading] = useState(false)
  const [rcToMobileError, setRcToMobileError] = useState("")
  const [rcToMobileData, setRcToMobileData] = useState<any | null>(null)
  const [rcToMobileFetchedReg, setRcToMobileFetchedReg] = useState("")
  const rcToMobileAutoStartedRef = useRef(false)
  const [panNumber, setPanNumber] = useState("")
  const [panLoading, setPanLoading] = useState(false)
  const [panError, setPanError] = useState("")
  const [panData, setPanData] = useState<any | null>(null)
  const [panFetched, setPanFetched] = useState("")
  const panAutoStartedRef = useRef(false)
  const [ownerHistoryRegistration, setOwnerHistoryRegistration] = useState("")
  const [ownerHistoryLoading, setOwnerHistoryLoading] = useState(false)
  const [ownerHistoryError, setOwnerHistoryError] = useState("")
  const [ownerHistoryData, setOwnerHistoryData] = useState<any | null>(null)
  const [ownerHistoryFetchedReg, setOwnerHistoryFetchedReg] = useState("")
  const ownerHistoryAutoStartedRef = useRef(false)

  const rcRegistration = rcRegistrationProp ?? rcRegistrationInternal
  const rcWhatsapp = rcWhatsappProp ?? rcWhatsappInternal
  const rcResult = rcResultProp ?? rcResultInternal

  const guestPhoneDigits = (guestPhone || "").replace(/\D/g, "")
  const guestPhoneValid = guestPhoneDigits.length >= 10 && guestPhoneDigits.length <= 15

  useEffect(() => {
    if (rcResultProp !== undefined) return
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const purpose = (params.get("purpose") || "").trim()
    if (purpose) return
    const transactionId = params.get("transactionId")
    const registration = params.get("registration")
    if (transactionId && registration) {
      setRcResultInternal(`PAY_SUCCESS::${registration}::${transactionId}`)
    }
  }, [rcResultProp])

  const resetRcToMobileCard = () => {
    setRcToMobileRegistration("")
    setRcToMobileLoading(false)
    setRcToMobileError("")
    setRcToMobileData(null)
    setRcToMobileFetchedReg("")
    rcToMobileAutoStartedRef.current = false
  }

  const resetPanCard = () => {
    setPanNumber("")
    setPanLoading(false)
    setPanError("")
    setPanData(null)
    setPanFetched("")
    panAutoStartedRef.current = false
  }

  const resetOwnerHistoryCard = () => {
    setOwnerHistoryRegistration("")
    setOwnerHistoryLoading(false)
    setOwnerHistoryError("")
    setOwnerHistoryData(null)
    setOwnerHistoryFetchedReg("")
    ownerHistoryAutoStartedRef.current = false
  }

  useEffect(() => {
    if (!rcToMobileData) return
    const timeoutId = window.setTimeout(() => resetRcToMobileCard(), 30_000)
    return () => window.clearTimeout(timeoutId)
  }, [rcToMobileData])

  useEffect(() => {
    if (!panData) return
    const timeoutId = window.setTimeout(() => resetPanCard(), 30_000)
    return () => window.clearTimeout(timeoutId)
  }, [panData])

  useEffect(() => {
    if (!ownerHistoryData) return
    const timeoutId = window.setTimeout(() => resetOwnerHistoryCard(), 30_000)
    return () => window.clearTimeout(timeoutId)
  }, [ownerHistoryData])

  const fetchRcToMobile = async (opts?: { transactionId?: string; reg?: string }) => {
    const reg = normalizeRegistration(opts?.reg ?? rcToMobileRegistration)
    if (!reg || rcToMobileLoading) return
    setRcToMobileError("")
    setRcToMobileData(null)
    setRcToMobileLoading(true)
    try {
      const transactionId = (opts?.transactionId || "").trim()
      const url = transactionId
        ? `/api/rc/to-mobile?registrationNumber=${encodeURIComponent(reg)}&transactionId=${encodeURIComponent(transactionId)}`
        : `/api/rc/to-mobile?registrationNumber=${encodeURIComponent(reg)}`
      const res = await fetch(url, { method: "GET" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "RC-to-mobile lookup failed")
      setRcToMobileData(json?.data ?? null)
      setRcToMobileFetchedReg(reg)
      setRcToMobileRegistration(reg)
    } catch (e: any) {
      setRcToMobileError(e?.message || "RC-to-mobile lookup failed")
    } finally {
      setRcToMobileLoading(false)
    }
  }

  const fetchPanDetails = async (opts?: { transactionId?: string; pan?: string }) => {
    const pan = normalizeRegistration(opts?.pan ?? panNumber)
    if (!pan || panLoading) return
    setPanError("")
    setPanData(null)
    setPanLoading(true)
    try {
      const transactionId = (opts?.transactionId || "").trim()
      const url = transactionId
        ? `/api/pan/details?panNumber=${encodeURIComponent(pan)}&transactionId=${encodeURIComponent(transactionId)}`
        : `/api/pan/details?panNumber=${encodeURIComponent(pan)}`
      const res = await fetch(url, { method: "GET" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "PAN lookup failed")
      setPanData(json?.data ?? null)
      setPanFetched(pan)
      setPanNumber(pan)
    } catch (e: any) {
      setPanError(e?.message || "PAN lookup failed")
    } finally {
      setPanLoading(false)
    }
  }

  const fetchOwnerHistory = async (opts?: { transactionId?: string; reg?: string }) => {
    const reg = normalizeRegistration(opts?.reg ?? ownerHistoryRegistration)
    if (!reg || ownerHistoryLoading) return
    setOwnerHistoryError("")
    setOwnerHistoryData(null)
    setOwnerHistoryLoading(true)
    try {
      const transactionId = (opts?.transactionId || "").trim()
      const url = transactionId
        ? `/api/rc/owner-history?registrationNumber=${encodeURIComponent(reg)}&transactionId=${encodeURIComponent(transactionId)}`
        : `/api/rc/owner-history?registrationNumber=${encodeURIComponent(reg)}`
      const res = await fetch(url, { method: "GET" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Owner history lookup failed")
      setOwnerHistoryData(json?.data ?? null)
      setOwnerHistoryFetchedReg(reg)
      setOwnerHistoryRegistration(reg)
    } catch (e: any) {
      setOwnerHistoryError(e?.message || "Owner history lookup failed")
    } finally {
      setOwnerHistoryLoading(false)
    }
  }

  const handleRcToMobilePayGuest = async () => {
    const reg = normalizeRegistration(rcToMobileRegistration)
    if (!reg) return
    if (!guestPhoneValid) {
      setRcToMobileError("Payment phone is not configured. Please contact support.")
      return
    }
    setRcToMobileError("")
    setRcToMobileLoading(true)
    try {
      const res = await fetch("/api/cashfree/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "rc_to_mobile", registrationNumber: reg, guest: true, customerPhone: guestPhone }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Unable to start payment")

      const mode = json?.mode || "sandbox"
      const loader = await import("@/lib/cashfree-client")
      const cashfree = await loader.loadCashfree(mode)
      if (!cashfree) throw new Error("Cashfree failed to load")
      await cashfree.checkout({ paymentSessionId: json.paymentSessionId, redirectTarget: "_self" } as any)
    } catch (e: any) {
      setRcToMobileError(e?.message || "Payment failed")
      setRcToMobileLoading(false)
    }
  }

  const handlePanPayGuest = async () => {
    const pan = normalizeRegistration(panNumber)
    if (!pan) return
    if (!guestPhoneValid) {
      setPanError("Payment phone is not configured. Please contact support.")
      return
    }
    setPanError("")
    setPanLoading(true)
    try {
      const res = await fetch("/api/cashfree/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "pan_details", panNumber: pan, guest: true, customerPhone: guestPhone }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Unable to start payment")

      const mode = json?.mode || "sandbox"
      const loader = await import("@/lib/cashfree-client")
      const cashfree = await loader.loadCashfree(mode)
      if (!cashfree) throw new Error("Cashfree failed to load")
      await cashfree.checkout({ paymentSessionId: json.paymentSessionId, redirectTarget: "_self" } as any)
    } catch (e: any) {
      setPanError(e?.message || "Payment failed")
      setPanLoading(false)
    }
  }

  const handleOwnerHistoryPayGuest = async () => {
    const reg = normalizeRegistration(ownerHistoryRegistration)
    if (!reg) return
    if (!guestPhoneValid) {
      setOwnerHistoryError("Payment phone is not configured. Please contact support.")
      return
    }
    setOwnerHistoryError("")
    setOwnerHistoryLoading(true)
    try {
      const res = await fetch("/api/cashfree/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "rc_owner_history", registrationNumber: reg, guest: true, customerPhone: guestPhone }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Unable to start payment")

      const mode = json?.mode || "sandbox"
      const loader = await import("@/lib/cashfree-client")
      const cashfree = await loader.loadCashfree(mode)
      if (!cashfree) throw new Error("Cashfree failed to load")
      await cashfree.checkout({ paymentSessionId: json.paymentSessionId, redirectTarget: "_self" } as any)
    } catch (e: any) {
      setOwnerHistoryError(e?.message || "Payment failed")
      setOwnerHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const purpose = (params.get("purpose") || "").trim().toLowerCase()
    const transactionId = params.get("transactionId") || ""
    const pan = params.get("pan") || ""
    if (purpose !== "pan_details" || !transactionId || !pan) return
    if (panAutoStartedRef.current) return

    panAutoStartedRef.current = true
    setOpenServiceId("pan_details")
    const normalizedPan = normalizeRegistration(pan)
    setPanNumber(normalizedPan)
    // Ensure state settles before calling.
    setTimeout(() => void fetchPanDetails({ transactionId, pan: normalizedPan }), 0)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const purpose = (params.get("purpose") || "").trim().toLowerCase()
    const transactionId = params.get("transactionId") || ""
    const registration = params.get("registration") || ""
    if (!transactionId || !registration) return

    if (purpose === "rc_to_mobile") {
      if (rcToMobileAutoStartedRef.current) return
      rcToMobileAutoStartedRef.current = true
      setOpenServiceId("rc_to_mobile")
      const normalized = normalizeRegistration(registration)
      setRcToMobileRegistration(normalized)
      setTimeout(() => void fetchRcToMobile({ transactionId, reg: normalized }), 0)
      return
    }

    if (purpose === "rc_owner_history") {
      if (ownerHistoryAutoStartedRef.current) return
      ownerHistoryAutoStartedRef.current = true
      setOpenServiceId("rc_owner_history")
      const normalized = normalizeRegistration(registration)
      setOwnerHistoryRegistration(normalized)
      setTimeout(() => void fetchOwnerHistory({ transactionId, reg: normalized }), 0)
    }
  }, [])

  const handleRcPayInternal = async () => {
    const registration = normalizeRegistration(rcRegistration)
    if (!registration) {
      setRcResultInternal("Enter vehicle registration to continue.")
      return
    }

    const digitsOnly = (rcWhatsapp || "").replace(/\D/g, "")
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      setRcResultInternal("Please enter a valid phone number (with country code).")
      return
    }

    setRcResultInternal("Starting payment...")
    try {
      const res = await fetch("/api/cashfree/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purpose: "download",
          registrationNumber: registration,
          guest: true,
          customerPhone: rcWhatsapp,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = json?.error || "Unable to start payment"
        setRcResultInternal(String(msg))
        return
      }

      const mode = json?.mode || "sandbox"
      const loader = await import("@/lib/cashfree-client")
      const cashfree = await loader.loadCashfree(mode)
      if (!cashfree) throw new Error("Cashfree failed to load")

      await cashfree.checkout({ paymentSessionId: json.paymentSessionId, redirectTarget: "_self" } as any)
    } catch (e: any) {
      setRcResultInternal(e?.message || "Payment failed")
    }
  }

  const handleRcPrimaryAction = () => {
    if (isAuthenticated) {
      const registration = normalizeRegistration(rcRegistration)
      if (!registration) return
      router.push(`/download?registrationNumber=${encodeURIComponent(registration)}`)
      return
    }

    if (onRcPay) onRcPay()
    else void handleRcPayInternal()
  }

  const renderExpandedContent = (serviceId: ServiceId) => {
    if (serviceId === "rc_download") {
      return (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="text-sm text-muted-foreground">Instant RC Download</div>
            <div className="text-3xl font-bold">{rcDisplayPriceText}</div>
          </div>
          <div className="text-xs text-muted-foreground -mt-1">per download</div>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rc-vrn" className="text-xs font-semibold uppercase tracking-wide">
                Vehicle Registration Number
              </Label>
              <Input
                id="rc-vrn"
                placeholder="MH12AB1234"
                value={rcRegistration}
                onChange={(e) => {
                  const nextValue = e.target.value.toUpperCase()
                  if (onRcRegistrationChange) onRcRegistrationChange(nextValue)
                  else setRcRegistrationInternal(nextValue)
                }}
                className="h-11 font-mono tracking-widest"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rc-wa" className="text-xs font-semibold uppercase tracking-wide">
                Whatsapp Number
              </Label>
              <Input
                id="rc-wa"
                placeholder="+91XXXXXXXXXX"
                value={rcWhatsapp}
                onChange={(e) => {
                  const nextValue = e.target.value
                  if (onRcWhatsappChange) onRcWhatsappChange(nextValue)
                  else setRcWhatsappInternal(nextValue)
                }}
                onFocus={() => {
                  if (!rcWhatsapp) {
                    if (onRcWhatsappChange) onRcWhatsappChange("+91")
                    else setRcWhatsappInternal("+91")
                  }
                }}
                className="h-11"
                autoComplete="tel"
                inputMode="tel"
              />
            </div>

            <Button className="w-full h-11" disabled={!normalizeRegistration(rcRegistration)} onClick={handleRcPrimaryAction}>
              {isAuthenticated ? "Continue" : `Pay ${rcDisplayPriceText}`}
            </Button>

            {!isAuthenticated && (
              <Button variant="outline" className="w-full h-11" onClick={() => router.push("/login")}>
                Login & Pay {rcRegisteredPriceText}
              </Button>
            )}

            {rcResult ? (
              <div className="text-sm text-muted-foreground">
                {rcResult.startsWith("PAY_SUCCESS::") ? (
                  (() => {
                    const [, registration, transactionId] = rcResult.split("::")
                    return (
                      <div>
                        Payment confirmed.{" "}
                        <a
                          href={`/payment/success?registration=${encodeURIComponent(registration)}&transactionId=${encodeURIComponent(transactionId)}`}
                          className="text-primary underline"
                        >
                          Open download
                        </a>
                      </div>
                    )
                  })()
                ) : (
                  rcResult
                )}
              </div>
            ) : null}
          </div>
        </div>
      )
    }

    if (serviceId === "pan_details") {
      return (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="text-sm text-muted-foreground">PAN Details</div>
            <div className="text-3xl font-bold">{panDisplayPriceText}</div>
          </div>
          <div className="text-xs text-muted-foreground -mt-1">per PAN data</div>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pan-number" className="text-xs font-semibold uppercase tracking-wide">
                PAN Number
              </Label>
              <Input
                id="pan-number"
                placeholder="ABCDE1234F"
                value={panNumber}
                onChange={(e) => {
                  if (panData) return
                  setPanNumber(e.target.value.toUpperCase())
                }}
                className="h-11 font-mono tracking-widest"
                autoComplete="off"
                disabled={panLoading || Boolean(panData)}
              />
            </div>

            {panError ? <div className="text-sm text-destructive">{panError}</div> : null}

            {panData ? (
              <Button className="w-full h-11" variant="outline" onClick={resetPanCard}>
                Clear
              </Button>
            ) : isAuthenticated ? (
              <Button
                className="w-full h-11"
                disabled={
                  !normalizeRegistration(panNumber) ||
                  panLoading ||
                  (Boolean(panFetched) && panFetched === normalizeRegistration(panNumber))
                }
                onClick={() => void fetchPanDetails()}
              >
                {panLoading ? "Fetching..." : `Fetch PAN Details (₹${panDisplayPrice})`}
              </Button>
            ) : (
              <Button
                className="w-full h-11"
                disabled={!normalizeRegistration(panNumber) || panLoading || (Boolean(panFetched) && panFetched === normalizeRegistration(panNumber))}
                onClick={() => void handlePanPayGuest()}
              >
                {panLoading ? "Starting payment..." : `Pay ${panDisplayPriceText}`}
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
                  const pan = formatValue(core?.pan_number ?? core?.panNumber ?? core?.pan ?? panNumber)

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
                        <div key={item.label} className="flex items-start justify-between gap-6 border-b border-border/60 py-2">
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
          </div>
        </div>
      )
    }

    if (serviceId === "rc_to_mobile") {
      return (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="text-sm text-muted-foreground">RC to Mobile Number</div>
            <div className="text-3xl font-bold">{rcToMobileDisplayPriceText}</div>
          </div>
          <div className="text-xs text-muted-foreground -mt-1">per mobile</div>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rc-to-mobile-vrn" className="text-xs font-semibold uppercase tracking-wide">
                Vehicle Registration Number
              </Label>
              <Input
                id="rc-to-mobile-vrn"
                placeholder="MH12AB1234"
                value={rcToMobileRegistration}
                onChange={(e) => {
                  if (rcToMobileData) return
                  setRcToMobileRegistration(e.target.value.toUpperCase())
                }}
                className="h-11 font-mono tracking-widest"
                autoComplete="off"
                disabled={rcToMobileLoading || Boolean(rcToMobileData)}
              />
            </div>

            {rcToMobileError ? <div className="text-sm text-destructive">{rcToMobileError}</div> : null}

            {rcToMobileData ? (
              <Button className="w-full h-11" variant="outline" onClick={resetRcToMobileCard}>
                Clear
              </Button>
            ) : isAuthenticated ? (
              <Button
                className="w-full h-11"
                disabled={
                  !normalizeRegistration(rcToMobileRegistration) ||
                  rcToMobileLoading ||
                  (Boolean(rcToMobileFetchedReg) && rcToMobileFetchedReg === normalizeRegistration(rcToMobileRegistration))
                }
                onClick={() => void fetchRcToMobile()}
              >
                {rcToMobileLoading ? "Fetching..." : `Fetch Mobile (${rcToMobileDisplayPriceText})`}
              </Button>
            ) : (
              <>
                <Button
                  className="w-full h-11"
                  disabled={
                    !normalizeRegistration(rcToMobileRegistration) ||
                    rcToMobileLoading ||
                    (Boolean(rcToMobileFetchedReg) && rcToMobileFetchedReg === normalizeRegistration(rcToMobileRegistration))
                  }
                  onClick={() => void handleRcToMobilePayGuest()}
                >
                  {rcToMobileLoading ? "Starting payment..." : `Pay ${rcToMobileDisplayPriceText}`}
                </Button>
                <Button variant="outline" className="w-full h-11" onClick={() => router.push("/login")}>
                  Login & Pay {rcToMobileRegisteredPriceText}
                </Button>
              </>
            )}

            {rcToMobileData ? (
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="text-sm font-semibold mb-2">Result</div>
                {(() => {
                  const root = rcToMobileData as any
                  const core = root?.data ?? root?.result ?? root?.response ?? root ?? {}
                  const rcNumber = String(
                    core?.rc_number ??
                      core?.rcNumber ??
                      core?.registration_number ??
                      core?.registrationNumber ??
                      rcToMobileRegistration ??
                      "",
                  )
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
          </div>
        </div>
      )
    }

    if (serviceId === "rc_owner_history") {
      return (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="text-sm text-muted-foreground">RC Owner History</div>
            <div className="text-3xl font-bold">{ownerHistoryDisplayPriceText}</div>
          </div>
          <div className="text-xs text-muted-foreground -mt-1">per report</div>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="owner-history-vrn" className="text-xs font-semibold uppercase tracking-wide">
                Vehicle Registration Number
              </Label>
              <Input
                id="owner-history-vrn"
                placeholder="MH12AB1234"
                value={ownerHistoryRegistration}
                onChange={(e) => {
                  if (ownerHistoryData) return
                  setOwnerHistoryRegistration(e.target.value.toUpperCase())
                }}
                className="h-11 font-mono tracking-widest"
                autoComplete="off"
                disabled={ownerHistoryLoading || Boolean(ownerHistoryData)}
              />
            </div>

            {ownerHistoryError ? <div className="text-sm text-destructive">{ownerHistoryError}</div> : null}

            {ownerHistoryData ? (
              <Button className="w-full h-11" variant="outline" onClick={resetOwnerHistoryCard}>
                Clear
              </Button>
            ) : isAuthenticated ? (
              <Button
                className="w-full h-11"
                disabled={
                  !normalizeRegistration(ownerHistoryRegistration) ||
                  ownerHistoryLoading ||
                  (Boolean(ownerHistoryFetchedReg) &&
                    ownerHistoryFetchedReg === normalizeRegistration(ownerHistoryRegistration))
                }
                onClick={() => void fetchOwnerHistory()}
              >
                {ownerHistoryLoading ? "Fetching..." : `Fetch Owner History (${ownerHistoryDisplayPriceText})`}
              </Button>
            ) : (
              <>
                <Button
                  className="w-full h-11"
                  disabled={
                    !normalizeRegistration(ownerHistoryRegistration) ||
                    ownerHistoryLoading ||
                    (Boolean(ownerHistoryFetchedReg) &&
                      ownerHistoryFetchedReg === normalizeRegistration(ownerHistoryRegistration))
                  }
                  onClick={() => void handleOwnerHistoryPayGuest()}
                >
                  {ownerHistoryLoading ? "Starting payment..." : `Pay ${ownerHistoryDisplayPriceText}`}
                </Button>
                <Button variant="outline" className="w-full h-11" onClick={() => router.push("/login")}>
                  Login & Pay {ownerHistoryRegisteredPriceText}
                </Button>
              </>
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
          </div>
        </div>
      )
    }

    return (
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-sm text-muted-foreground">Service</div>
          <div className="text-sm font-semibold text-muted-foreground">Coming soon</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {services.map((service) => {
          const isOpen = service.id === openServiceId
          const Icon = service.icon
          return (
            <Collapsible
              key={service.id}
              open={isOpen}
              onOpenChange={(nextOpen) => setOpenServiceId(nextOpen ? service.id : null)}
            >
              <Card
                className={cn(
                  "overflow-hidden border-2 transition-colors",
                  isOpen ? "border-primary/60 shadow-sm lg:col-span-2" : "border-primary/20 hover:border-primary/40",
                )}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-expanded={isOpen}
                  >
                    <div className="px-4 py-4 flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg shrink-0", service.iconClassName)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold leading-tight break-words whitespace-normal">{service.title}</div>
                            <div className="text-xs text-muted-foreground break-words whitespace-normal">
                              {service.priceCaption}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <div className="text-[10px] text-muted-foreground hidden sm:block">
                              {isOpen ? "Click to Collapse" : "Click to Expand"}
                            </div>
                            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                  {renderExpandedContent(service.id)}
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )
        })}
      </div>
    </div>
  )
}

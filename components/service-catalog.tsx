"use client"

import type { ComponentType } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, FileClock, IdCard, Smartphone, Zap } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
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

  const rcGuestPrice = GUEST_RC_DOWNLOAD_PRICE_INR
  const rcRegisteredPrice = REGISTERED_RC_DOWNLOAD_PRICE_INR
  const rcDisplayPrice = isAuthenticated ? rcRegisteredPrice : rcGuestPrice

  const panDisplayPrice = getPanDetailsPriceInr(!isAuthenticated)
  const rcToMobileDisplayPrice = getRcToMobilePriceInr(!isAuthenticated)
  const ownerHistoryDisplayPrice = getRcOwnerHistoryPriceInr(!isAuthenticated)

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

  const [rcToMobileRegistration, setRcToMobileRegistration] = useState("")
  const [panNumber, setPanNumber] = useState("")
  const [panLoading, setPanLoading] = useState(false)
  const [panError, setPanError] = useState("")
  const [panData, setPanData] = useState<any | null>(null)
  const [panFetched, setPanFetched] = useState("")
  const panAutoStartedRef = useRef(false)
  const [ownerHistoryRegistration, setOwnerHistoryRegistration] = useState("")

  const rcRegistration = rcRegistrationProp ?? rcRegistrationInternal
  const rcWhatsapp = rcWhatsappProp ?? rcWhatsappInternal
  const rcResult = rcResultProp ?? rcResultInternal

  useEffect(() => {
    if (rcResultProp !== undefined) return
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const transactionId = params.get("transactionId")
    const registration = params.get("registration")
    if (transactionId && registration) {
      setRcResultInternal(`PAY_SUCCESS::${registration}::${transactionId}`)
    }
  }, [rcResultProp])

  const resetPanCard = () => {
    setPanNumber("")
    setPanLoading(false)
    setPanError("")
    setPanData(null)
    setPanFetched("")
    panAutoStartedRef.current = false
  }

  useEffect(() => {
    if (!panData) return
    const timeoutId = window.setTimeout(() => resetPanCard(), 30_000)
    return () => window.clearTimeout(timeoutId)
  }, [panData])

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

  const handlePanPayGuest = async () => {
    const pan = normalizeRegistration(panNumber)
    if (!pan) return
    setPanError("")
    setPanLoading(true)
    try {
      const res = await fetch("/api/cashfree/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "pan_details", panNumber: pan, guest: true }),
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
            <div className="text-3xl font-bold">₹{rcDisplayPrice}</div>
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
              {isAuthenticated ? "Continue" : `Pay ₹${rcDisplayPrice}`}
            </Button>

            {!isAuthenticated && (
              <Button variant="outline" className="w-full h-11" onClick={() => router.push("/login")}>
                Login & Pay ₹{rcRegisteredPrice}
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
            <div className="text-3xl font-bold">₹{panDisplayPrice}</div>
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
                disabled={!normalizeRegistration(panNumber) || panLoading || (Boolean(panFetched) && panFetched === normalizeRegistration(panNumber))}
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
                {panLoading ? "Starting payment..." : `Pay ₹${panDisplayPrice}`}
              </Button>
            )}

            {panData ? (
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="text-sm font-semibold mb-2">Result</div>
                {(() => {
                  const root = panData as any
                  const core = root?.data ?? root?.result ?? root?.response ?? root ?? {}
                  const normalizeValue = (value: unknown) => String(value ?? "").trim()
                  const formatDate = (value: string) => {
                    const text = (value || "").trim()
                    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                      const [yyyy, mm, dd] = text.split("-")
                      return `${dd}-${mm}-${yyyy}`
                    }
                    return text
                  }

                  const nameProvided = normalizeValue(core?.name_provided ?? core?.nameProvided ?? core?.input_name ?? core?.inputName)
                  const pan = normalizeValue(core?.pan_number ?? core?.panNumber ?? core?.pan ?? panNumber)

                  const firstName = normalizeValue(core?.first_name ?? core?.firstName)
                  const lastName = normalizeValue(core?.last_name ?? core?.lastName)
                  const registeredName = normalizeValue(core?.registered_name ?? core?.registeredName ?? core?.full_name ?? core?.fullName)
                  const panType = normalizeValue(core?.pan_type ?? core?.panType ?? core?.type)
                  const gender = normalizeValue(core?.gender)
                  const dob = formatDate(normalizeValue(core?.date_of_birth ?? core?.dateOfBirth ?? core?.dob))
                  const maskedAadhaar = normalizeValue(core?.masked_aadhaar ?? core?.maskedAadhaar ?? core?.aadhaar_masked ?? core?.aadhaarMasked)
                  const email = normalizeValue(core?.email ?? core?.email_id ?? core?.emailId)
                  const mobile = normalizeValue(core?.mobile_number ?? core?.mobileNumber ?? core?.mobile ?? core?.phone ?? core?.phone_number ?? core?.phoneNumber)

                  const aadhaarLinkRaw = core?.aadhaar_link ?? core?.aadhaarLink ?? core?.aadhaar_linked ?? core?.aadhaarLinked
                  const aadhaarLink =
                    typeof aadhaarLinkRaw === "boolean"
                      ? aadhaarLinkRaw
                        ? "True"
                        : "False"
                      : normalizeValue(aadhaarLinkRaw)

                  const address = normalizeValue(core?.address ?? core?.full_address ?? core?.fullAddress)
                  const panRefId = normalizeValue(
                    core?.pan_ref_id ??
                      core?.panRefId ??
                      core?.reference_id ??
                      core?.referenceId ??
                      core?.verification_id ??
                      core?.verificationId,
                  )
                  const status = normalizeValue(core?.status ?? core?.pan_status ?? core?.panStatus ?? core?.message_code ?? core?.messageCode)
                  const message = normalizeValue(core?.message ?? core?.result_message ?? core?.resultMessage ?? core?.remarks)
                  const nameOnCard = normalizeValue(
                    core?.name_on_pan_card ?? core?.nameOnPanCard ?? core?.name_pan_card ?? core?.namePanCard,
                  )

                  const items: Array<{ label: string; value: string }> = [
                    { label: "Name Provided", value: nameProvided || "-" },
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
                    { label: "Name Pan Card", value: nameOnCard || "-" },
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
            <div className="text-3xl font-bold">₹{rcToMobileDisplayPrice}</div>
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
                onChange={(e) => setRcToMobileRegistration(e.target.value.toUpperCase())}
                className="h-11 font-mono tracking-widest"
                autoComplete="off"
              />
            </div>

            <Button className="w-full h-11" disabled>
              Coming Soon
            </Button>
          </div>
        </div>
      )
    }

    if (serviceId === "rc_owner_history") {
      return (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="text-sm text-muted-foreground">RC Owner History</div>
            <div className="text-3xl font-bold">₹{ownerHistoryDisplayPrice}</div>
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
                onChange={(e) => setOwnerHistoryRegistration(e.target.value.toUpperCase())}
                className="h-11 font-mono tracking-widest"
                autoComplete="off"
              />
            </div>

            <Button className="w-full h-11" disabled>
              Coming Soon
            </Button>
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

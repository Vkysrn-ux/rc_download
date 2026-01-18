"use client"

import type { ComponentType } from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, IdCard, Smartphone, Zap } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { GUEST_RC_DOWNLOAD_PRICE_INR, REGISTERED_RC_DOWNLOAD_PRICE_INR } from "@/lib/pricing"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ServiceId = "rc_download" | "vrn_to_mobile" | "pan_details"

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

  const services = useMemo<Service[]>(
    () => [
      {
        id: "rc_download",
        title: "RC Download",
        subtitle: "Quick one-time download",
        priceCaption: `₹${rcGuestPrice} per download`,
        icon: Zap,
        iconClassName: "bg-blue-50 text-primary",
      },
      {
        id: "vrn_to_mobile",
        title: "VRN To Mobile Number",
        subtitle: "Fetch the linked mobile number",
        priceCaption: "₹25 per Mobile",
        icon: Smartphone,
        iconClassName: "bg-emerald-50 text-emerald-700",
      },
      {
        id: "pan_details",
        title: "PAN Details",
        subtitle: "Lookup PAN information",
        priceCaption: "₹20 per PAN data",
        icon: IdCard,
        iconClassName: "bg-emerald-50 text-emerald-700",
      },
    ],
    [rcGuestPrice],
  )

  const [openServiceId, setOpenServiceId] = useState<ServiceId | null>("rc_download")

  const [rcRegistrationInternal, setRcRegistrationInternal] = useState("")
  const [rcWhatsappInternal, setRcWhatsappInternal] = useState("+91")
  const [rcResultInternal, setRcResultInternal] = useState<string | null>(null)

  const [vrnRegistration, setVrnRegistration] = useState("")
  const [panNumber, setPanNumber] = useState("")

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

    if (serviceId === "vrn_to_mobile") {
      return (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="text-sm text-muted-foreground">VRN To Mobile Number</div>
            <div className="text-3xl font-bold">₹25</div>
          </div>
          <div className="text-xs text-muted-foreground -mt-1">per mobile</div>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vrn-vrn" className="text-xs font-semibold uppercase tracking-wide">
                Vehicle Registration Number
              </Label>
              <Input
                id="vrn-vrn"
                placeholder="MH12AB1234"
                value={vrnRegistration}
                onChange={(e) => setVrnRegistration(e.target.value.toUpperCase())}
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
          <div className="text-sm text-muted-foreground">PAN Details</div>
          <div className="text-3xl font-bold">₹20</div>
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
              onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
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

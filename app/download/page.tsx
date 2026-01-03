"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Search } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { RcDownloadStepper } from "@/components/rc-download-stepper"
import { RcApiProgressChecklist, type RcApiStepStatus } from "@/components/rc-api-progress-checklist"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/\s/g, "")
}

function DownloadPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated } = useAuth()

  const [registrationNumber, setRegistrationNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState("")
  const [apiSteps, setApiSteps] = useState<RcApiStepStatus[] | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const autoStartedRef = useRef(false)

  const walletPrice = 20
  const canPayFromWallet = Boolean(isAuthenticated && user && user.walletBalance >= walletPrice)

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [])

  const startLookup = (regNumberRaw: string) => {
    const regNumber = normalizeRegistration(regNumberRaw)
    if (!regNumber) return

    setError("")
    setApiSteps(["active", "pending"])
    setLoading(true)
    setConfirming(false)
    setRegistrationNumber(regNumber)

    eventSourceRef.current?.close()
    const source = new EventSource(`/api/rc/lookup/stream?registrationNumber=${encodeURIComponent(regNumber)}`)
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
      setLoading(false)

      if (!payload?.data) {
        setError("Lookup failed")
        return
      }

      if (canPayFromWallet) {
        setConfirming(true)
        void (async () => {
          try {
            const res = await fetch("/api/download/purchase", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ registrationNumber: regNumber, paymentMethod: "wallet" }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
              setConfirming(false)
              router.push(`/payment/confirm?registration=${encodeURIComponent(regNumber)}&source=upi`)
              return
            }

            router.push(
              `/payment/success?registration=${encodeURIComponent(regNumber)}&transactionId=${encodeURIComponent(json?.transactionId || "")}`,
            )
          } catch {
            setConfirming(false)
            router.push(`/payment/confirm?registration=${encodeURIComponent(regNumber)}&source=upi`)
          }
        })()
        return
      }

      if (isAuthenticated) {
        router.push(`/payment/confirm?registration=${encodeURIComponent(regNumber)}&source=upi`)
        return
      }

      router.push(`/payment/confirm?registration=${encodeURIComponent(regNumber)}&source=upi&guest=true`)
    })

    source.addEventListener("not_found", (event) => {
      const payload = JSON.parse((event as MessageEvent).data || "{}")
      setError(payload?.error || "Registration number not found")
      setLoading(false)
      source.close()
    })

    source.addEventListener("server_error", (event) => {
      const payload = JSON.parse((event as MessageEvent).data || "{}")
      setError(payload?.error || "Lookup failed")
      setLoading(false)
      source.close()
    })

    source.onerror = () => {
      setError("Lookup failed")
      setLoading(false)
      source.close()
    }
  }

  const handleSearch = () => startLookup(registrationNumber)

  useEffect(() => {
    const regParam = searchParams.get("registrationNumber") || searchParams.get("registration") || ""
    if (!regParam) return
    const normalized = normalizeRegistration(regParam)
    if (!normalized) return

    setRegistrationNumber(normalized)

    const autostartValue = (searchParams.get("autostart") || "").trim().toLowerCase()
    const autostart = autostartValue === "1" || autostartValue === "true" || autostartValue === "yes"
    if (!autostart || autoStartedRef.current) return

    autoStartedRef.current = true
    setAcceptedTerms(true)
    // Ensure state settles before starting the lookup.
    setTimeout(() => startLookup(normalized), 0)
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push(isAuthenticated ? "/dashboard" : "/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Download RC</h1>
          </div>
          {!isAuthenticated && (
            <Link href="/login">
              <Button variant="outline" size="sm">
                Login for Discount
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <RcDownloadStepper step={1} className="max-w-2xl mx-auto" />

          {error && (
            <Alert variant="destructive" className="max-w-2xl mx-auto">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card className="max-w-2xl mx-auto shadow-sm">
            <CardHeader className="text-center">
              <CardTitle>Enter Vehicle</CardTitle>
              <CardDescription>Input registration number</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="registration" className="sr-only">
                  Registration Number
                </Label>
                <Input
                  id="registration"
                  type="text"
                  placeholder="ENTER VEHICLE NUMBER (E.G., MH12AB1234)"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                  className="h-12 text-center font-mono tracking-widest"
                  autoComplete="off"
                  inputMode="text"
                />
              </div>

              <div className="rounded-xl border bg-white p-3">
                <div className="flex items-start gap-3">
                  <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(value) => setAcceptedTerms(value === true)} />
                  <div className="space-y-1">
                    <Label htmlFor="terms" className="font-normal leading-relaxed">
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
                onClick={handleSearch}
                disabled={loading || confirming || !registrationNumber || !acceptedTerms}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {loading ? (
                  "Fetching..."
                ) : confirming ? (
                  "Processing..."
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Fetch RC Details
                  </>
                )}
              </Button>

              {(loading || apiSteps) && <RcApiProgressChecklist active={loading} steps={apiSteps} />}

              {!acceptedTerms && registrationNumber.trim() && (
                <p className="text-xs text-muted-foreground text-center">Please accept the Terms & Conditions to continue.</p>
              )}
              <p className="text-sm text-muted-foreground text-center">Try: MH12AB1234 or DL01CD5678</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function DownloadPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DownloadPageContent />
    </Suspense>
  )
}

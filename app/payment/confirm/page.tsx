"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { RcDownloadStepper } from "@/components/rc-download-stepper"
import { formatInr } from "@/lib/format"
import { getRcDownloadPriceInr, getPanDetailsPriceInr, getRcToMobilePriceInr, getRcOwnerHistoryPriceInr, MIN_WALLET_RECHARGE_INR } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Wallet, CheckCircle } from "lucide-react"
import { Separator } from "@/components/ui/separator"

type PaymentConfig = {
  enableFinvedex: boolean
}

function phoneDigits(value: string) {
  return (value || "").replace(/\D/g, "")
}

function PaymentConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, refreshUser } = useAuth()

  const registration = searchParams.get("registration") || ""
  const pan = searchParams.get("pan") || ""
  const purpose = (searchParams.get("purpose") || "download") as "download" | "pan_details" | "rc_to_mobile" | "rc_owner_history"
  const isGuest = !isAuthenticated

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [finvedexPhone, setFinvedexPhone] = useState("")

  const price =
    purpose === "pan_details" ? getPanDetailsPriceInr(isGuest) :
    purpose === "rc_to_mobile" ? getRcToMobilePriceInr(isGuest) :
    purpose === "rc_owner_history" ? getRcOwnerHistoryPriceInr(isGuest) :
    getRcDownloadPriceInr(isGuest)

  const purposeLabel =
    purpose === "pan_details" ? "PAN Details" :
    purpose === "rc_to_mobile" ? "RC to Mobile Number" :
    purpose === "rc_owner_history" ? "RC Owner History" :
    "Vehicle RC Download"

  const purposeRef = purpose === "pan_details" ? pan : registration
  const enableFinvedex = Boolean(config?.enableFinvedex)
  const canPayWithWallet = isAuthenticated
  const walletBalanceValue = Number(user?.walletBalance ?? 0)
  const walletBalance = Number.isFinite(walletBalanceValue) ? walletBalanceValue : 0
  const walletShortfall = Math.max(0, price - walletBalance)
  const recommendedTopup = Math.max(MIN_WALLET_RECHARGE_INR, Math.ceil(walletShortfall))
  const topupLink = `/wallet/recharge?amount=${recommendedTopup}`
  const hasInsufficientWallet = Boolean(isAuthenticated && user && walletBalance < price)

  useEffect(() => {
    fetch("/api/payment/config")
      .then((r) => r.json())
      .then((c) => setConfig(c))
      .catch(() => setConfig({ enableFinvedex: false }))
  }, [])

  const handleWalletPayment = async () => {
    setLoading(true)
    setError("")
    setInfo("")

    try {
      const res = await fetch("/api/download/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registrationNumber: purposeRef, paymentMethod: "wallet", guest: isGuest }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || "Payment failed. Please try again.")
        setLoading(false)
        return
      }

      await refreshUser()
      if (json?.status === "pending") {
        setInfo("Payment recorded as pending. You can proceed, but it may be reviewed later.")
      }

      setSuccess(true)
      setTimeout(() => {
        if (purpose === "pan_details") {
          router.push(`/services?purpose=pan_details&pan=${encodeURIComponent(pan)}&transactionId=${encodeURIComponent(json?.transactionId || "")}`)
        } else if (purpose === "rc_to_mobile" || purpose === "rc_owner_history") {
          router.push(`/services?purpose=${purpose}&registration=${encodeURIComponent(registration)}&transactionId=${encodeURIComponent(json?.transactionId || "")}`)
        } else {
          router.push(`/payment/success?registration=${encodeURIComponent(registration)}&transactionId=${encodeURIComponent(json?.transactionId || "")}`)
        }
      }, 1200)
    } catch {
      setError("Payment failed. Please try again.")
      setLoading(false)
    }
  }

  const handleFinvedexPayment = async () => {
    setLoading(true)
    setError("")
    setInfo("")

    if (!purposeRef) {
      setError("Missing reference number.")
      setLoading(false)
      return
    }

    const phone = phoneDigits(finvedexPhone)
    if (!phone || phone.length < 10 || phone.length > 15) {
      setError("Please enter a valid 10-digit phone number.")
      setLoading(false)
      return
    }

    try {
      const body: Record<string, unknown> = { purpose, customerPhone: phone, guest: isGuest }
      if (purpose === "pan_details") {
        body.panNumber = pan
      } else {
        body.registrationNumber = registration
      }

      const res = await fetch("/api/finvedex/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || "Unable to start payment. Please try again.")
        setLoading(false)
        return
      }

      if (json?.paymentUrl) {
        window.location.href = json.paymentUrl
      } else {
        setError("Could not get payment URL from Finvedex.")
        setLoading(false)
      }
    } catch (e: any) {
      setError(e?.message || "Unable to start payment. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Confirm Payment</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <RcDownloadStepper step={2} />
          {success ? (
            <Alert className="bg-blue-50 border-blue-200">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">Payment step completed. Redirecting…</AlertDescription>
            </Alert>
          ) : (
            <>
              {info && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-blue-900">{info}</AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                  <CardDescription>Review your order before payment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{purpose === "pan_details" ? "PAN Number" : "Registration Number"}</span>
                      <span className="font-medium">{purposeRef}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{purposeLabel}</span>
                      <span className="font-medium">{formatInr(price, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-lg">
                      <span className="font-semibold">Total Amount</span>
                      <span className="font-bold text-primary">{formatInr(price, { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {canPayWithWallet ? (
                <Card className="border-primary">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Wallet className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle>Pay from Wallet</CardTitle>
                        <CardDescription>
                          Current balance:{" "}
                          {formatInr(Number(user?.walletBalance ?? 0), {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardFooter className="flex flex-col gap-3">
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleWalletPayment}
                      disabled={loading || hasInsufficientWallet}
                    >
                      {loading ? "Processing..." : `Pay ${formatInr(price, { maximumFractionDigits: 0 })}`}
                    </Button>
                    {hasInsufficientWallet && (
                      <>
                        <div className="text-xs text-muted-foreground">
                          Insufficient balance. Minimum top up is INR {MIN_WALLET_RECHARGE_INR}.
                        </div>
                        <Button
                          variant="outline"
                          className="w-full bg-transparent"
                          onClick={() => router.push(topupLink)}
                        >
                          Add Money to Wallet
                        </Button>
                      </>
                    )}
                  </CardFooter>
                </Card>
              ) : (
                <>
                  {!enableFinvedex && (
                    <Card className="border-primary/40">
                      <CardHeader>
                        <CardTitle>Payments Temporarily Unavailable</CardTitle>
                        <CardDescription>We're upgrading payments. Please login to pay from your wallet.</CardDescription>
                      </CardHeader>
                      <CardFooter>
                        <Button className="w-full" size="lg" onClick={() => router.push("/login")}>
                          Login
                        </Button>
                      </CardFooter>
                    </Card>
                  )}

                  {enableFinvedex && (
                    <Card className="border-primary">
                      <CardHeader>
                        <CardTitle>Pay with Finvedex</CardTitle>
                        <CardDescription>UPI, Cards, NetBanking</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-1">
                          <Label htmlFor="finvedexPhone">Mobile Number</Label>
                          <Input
                            id="finvedexPhone"
                            inputMode="tel"
                            placeholder="Enter 10-digit mobile number"
                            value={finvedexPhone}
                            onChange={(e) => setFinvedexPhone(e.target.value)}
                          />
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={handleFinvedexPayment}
                          disabled={loading || !purposeRef}
                        >
                          {loading ? "Opening..." : `Pay ${formatInr(price, { maximumFractionDigits: 0 })}`}
                        </Button>
                      </CardFooter>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default function PaymentConfirmPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentConfirmContent />
    </Suspense>
  )
}

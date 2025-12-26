"use client"

import { useEffect, useMemo, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Wallet, QrCode, Smartphone, CheckCircle } from "lucide-react"
import { Separator } from "@/components/ui/separator"

type PaymentConfig = {
  upiId: string
  payeeName: string
  qrUrl: string
  autoApprove: boolean
}

function clampUpiText(value: string, maxLength: number) {
  return (value || "").trim().slice(0, maxLength)
}

function buildUpiUri(upiId: string, payeeName: string, amount: number, note: string) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: clampUpiText(payeeName || "RC Download", 25),
    am: amount.toFixed(2),
    cu: "INR",
    tn: clampUpiText(note, 50),
  })
  return `upi://pay?${params.toString()}`
}

function PaymentConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, refreshUser } = useAuth()

  const registration = searchParams.get("registration") || ""
  const source = searchParams.get("source") || ""
  const isGuest = searchParams.get("guest") === "true"

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [isMobile, setIsMobile] = useState(false)

  const price = isAuthenticated && !isGuest ? 20 : 30

  useEffect(() => {
    fetch("/api/payment/config")
      .then((r) => r.json())
      .then((c) => setConfig(c))
      .catch(() => setConfig({ upiId: "", payeeName: "", qrUrl: "", autoApprove: false }))
  }, [])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 768 ||
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      )
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const upiUri = useMemo(() => {
    if (!config?.upiId) return ""
    return buildUpiUri(config.upiId, config.payeeName, price, `RC Download ${registration}`)
  }, [config?.upiId, config?.payeeName, price, registration])

  useEffect(() => {
    let cancelled = false
    async function generate() {
      setQrDataUrl("")
      if (!upiUri) return
      try {
        const QRCode = (await import("qrcode")).default
        const url = await QRCode.toDataURL(upiUri, { errorCorrectionLevel: "M", margin: 2, width: 320 })
        if (!cancelled) setQrDataUrl(url)
      } catch {
        if (!cancelled) setQrDataUrl("")
      }
    }
    generate()
    return () => {
      cancelled = true
    }
  }, [upiUri, config?.qrUrl])

  const handlePayment = async () => {
    setLoading(true)
    setError("")
    setInfo("")

    try {
      const paymentMethod = source === "wallet" ? "wallet" : "upi"

      const res = await fetch("/api/download/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registrationNumber: registration, paymentMethod, guest: isGuest }),
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
        router.push(`/payment/success?registration=${encodeURIComponent(registration)}`)
      }, 1200)
    } catch {
      setError("Payment failed. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
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
          {success ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">Payment step completed. Redirecting…</AlertDescription>
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
                      <span className="text-muted-foreground">Registration Number</span>
                      <span className="font-medium">{registration}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">RC Download</span>
                      <span className="font-medium">₹{price}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-lg">
                      <span className="font-semibold">Total Amount</span>
                      <span className="font-bold text-primary">₹{price}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {source === "wallet" ? (
                <Card className="border-primary">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Wallet className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <CardTitle>Pay from Wallet</CardTitle>
                        <CardDescription>
                          Current balance: ₹{user?.walletBalance?.toFixed?.(2) ?? "0.00"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardFooter className="flex flex-col gap-3">
                    <Button className="w-full" size="lg" onClick={handlePayment} disabled={loading}>
                      {loading ? "Processing..." : `Pay ₹${price}`}
                    </Button>
                    {isAuthenticated && user && user.walletBalance < price && (
                      <Button
                        variant="outline"
                        className="w-full bg-transparent"
                        onClick={() => router.push("/wallet/recharge")}
                      >
                        Add Money to Wallet
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ) : (
                <Card className="border-primary">
                  <CardHeader>
                    <CardTitle>Pay via UPI</CardTitle>
                    <CardDescription>Scan QR or use the UPI ID</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!config?.upiId ? (
                      <Alert variant="destructive">
                        <AlertDescription>UPI is not configured. Set `PAYMENT_UPI_ID` in your environment.</AlertDescription>
                      </Alert>
                    ) : (
                      <>
                        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                          <div className="font-medium">UPI ID</div>
                          <div className="font-mono break-all">{config.upiId}</div>
                          {config.payeeName && (
                            <div className="text-muted-foreground mt-1">Payee: {config.payeeName}</div>
                          )}
                        </div>

                        {isMobile ? (
                          <Button className="w-full" size="lg" asChild>
                            <a href={upiUri || "#"}>
                              <Smartphone className="h-4 w-4 mr-2" />
                              Open UPI App
                            </a>
                          </Button>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <QrCode className="h-4 w-4" />
                              <span>Scan QR in any UPI app</span>
                            </div>
                            <div className="flex items-center justify-center">
                              {qrDataUrl ? (
                                <img
                                  src={qrDataUrl}
                                  alt="UPI QR"
                                  className="w-64 h-64 object-contain border rounded-lg bg-white"
                                />
                              ) : config.qrUrl ? (
                                <img
                                  src={config.qrUrl}
                                  alt="UPI QR"
                                  className="w-64 h-64 object-contain border rounded-lg bg-white"
                                />
                              ) : (
                                <div className="w-64 h-64 border rounded-lg bg-white flex items-center justify-center text-muted-foreground">
                                  <QrCode className="h-6 w-6" />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {!config.autoApprove && (
                          <p className="text-xs text-muted-foreground">
                            Payment may be marked pending until confirmed.
                          </p>
                        )}
                      </>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" size="lg" onClick={handlePayment} disabled={loading || !registration}>
                      {loading ? "Saving..." : "I've Paid"}
                    </Button>
                  </CardFooter>
                </Card>
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

"use client"

import { useEffect, useMemo, useRef, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { loadRazorpayCheckout } from "@/lib/razorpay-client"
import { loadCashfree } from "@/lib/cashfree-client"
import { shareManualPaymentProof } from "@/lib/manual-payment-proof"
import { RcDownloadStepper } from "@/components/rc-download-stepper"
import { formatInr } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Wallet, QrCode, Smartphone, CheckCircle } from "lucide-react"
import { Separator } from "@/components/ui/separator"

type PaymentConfig = {
  upiId: string
  payeeName: string
  qrUrl: string
  autoApprove: boolean
  enableRazorpay: boolean
  enableManualUpi: boolean
  enableCashfree: boolean
  cashfreeMode: "sandbox" | "production"
}

function clampUpiText(value: string, maxLength: number) {
  return (value || "").trim().slice(0, maxLength)
}

function buildUpiUri(upiId: string, payeeName: string, amount: number, note: string) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: clampUpiText(payeeName || "Vehicle RC Download", 25),
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
  const isGuest = searchParams.get("guest") === "true"

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [isMobile, setIsMobile] = useState(false)
  const [manualTxn, setManualTxn] = useState<{ transactionId: string; status: string } | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState("")
  const proofRef = useRef<HTMLDivElement | null>(null)
  const [guestName, setGuestName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [cashfreePhone, setCashfreePhone] = useState("")

  const price = isAuthenticated && !isGuest ? 20 : 30
  const enableRazorpay = Boolean(config?.enableRazorpay)
  const enableManualUpi = Boolean(config?.enableManualUpi)
  const enableCashfree = Boolean(config?.enableCashfree)
  const canPayWithWallet = isAuthenticated && !isGuest

  useEffect(() => {
    fetch("/api/payment/config")
      .then((r) => r.json())
      .then((c) => setConfig(c))
      .catch(() =>
        setConfig({
          upiId: "",
          payeeName: "",
          qrUrl: "",
          autoApprove: false,
          enableRazorpay: false,
          enableManualUpi: false,
          enableCashfree: false,
          cashfreeMode: "sandbox",
        }),
      )
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
    return buildUpiUri(config.upiId, config.payeeName, price, `Vehicle RC Download ${registration}`)
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

  const finishUpiFlow = (transactionId: string) => {
    setSuccess(true)
    setTimeout(() => {
      router.push(
        `/payment/success?registration=${encodeURIComponent(registration)}&transactionId=${encodeURIComponent(transactionId)}`,
      )
    }, 1200)
  }

  const sendWhatsAppProof = async (transactionId?: string) => {
    setShareError("")
    const adminNumber = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER || ""
    if (!adminNumber) {
      setShareError("Admin WhatsApp number is not configured.")
      return
    }

    setSharing(true)
    const now = new Date().toLocaleString()
    const displayName = isAuthenticated ? user?.name || "-" : "Guest"
    const displayUserId = isAuthenticated ? user?.id || "-" : "N/A"
    const message = [
      "Manual UPI payment (RC download)",
      `User: ${displayName}`,
      `User ID: ${displayUserId}`,
      `Registration: ${registration}`,
      `Amount: ₹${price}`,
      transactionId ? `Transaction ID: ${transactionId}` : "",
      `Time: ${now}`,
    ]
      .filter(Boolean)
      .join("\n")

    const result = await shareManualPaymentProof({
      adminNumber,
      message,
      screenshotEl: proofRef.current,
      filename: transactionId ? `download-${transactionId}.png` : undefined,
    })

    setSharing(false)
    if (!result.ok) {
      setShareError("Couldn't open WhatsApp. Please send the screenshot manually.")
    }
  }

  const handleWalletPayment = async () => {
    setLoading(true)
    setError("")
    setInfo("")

    try {
      const res = await fetch("/api/download/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registrationNumber: registration, paymentMethod: "wallet", guest: isGuest }),
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
        router.push(
          `/payment/success?registration=${encodeURIComponent(registration)}&transactionId=${encodeURIComponent(json?.transactionId || "")}`,
        )
      }, 1200)
    } catch {
      setError("Payment failed. Please try again.")
      setLoading(false)
    }
  }

  const handleUpiManualPayment = async () => {
    setLoading(true)
    setError("")
    setInfo("")
    setShareError("")

    try {
      const res = await fetch("/api/download/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registrationNumber: registration, paymentMethod: "upi", guest: isGuest }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || "Payment failed. Please try again.")
        setLoading(false)
        return
      }

      await refreshUser()
      setLoading(false)
      if (json?.status === "pending") {
        setInfo("Payment recorded as pending. You can proceed, but it may be reviewed later.")
      }

      setManualTxn({ transactionId: json?.transactionId || "", status: json?.status || "pending" })
      await sendWhatsAppProof(json?.transactionId).catch(() => {})
    } catch {
      setError("Payment failed. Please try again.")
      setLoading(false)
    }
  }

  const handleRazorpayPayment = async () => {
    setLoading(true)
    setError("")
    setInfo("")

    try {
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "download", registrationNumber: registration, guest: isGuest }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || "Unable to start payment. Please try again.")
        setLoading(false)
        return
      }

      await loadRazorpayCheckout()
      const RazorpayCtor = (window as any).Razorpay
      if (!RazorpayCtor) throw new Error("Razorpay failed to load")

      const rzp = new RazorpayCtor({
        key: json.keyId,
        amount: json.amount,
        currency: json.currency,
        name: json.name,
        description: json.description,
        order_id: json.orderId,
        prefill: json.prefill ?? undefined,
        modal: {
          ondismiss: () => setLoading(false),
        },
        handler: async (response: any) => {
          try {
            setLoading(true)
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ transactionId: json.transactionId, ...response }),
            })
            const verifyJson = await verifyRes.json().catch(() => ({}))
            if (!verifyRes.ok) {
              setError(verifyJson?.error || "Payment verification failed. Please contact support.")
              setLoading(false)
              return
            }

            await refreshUser()
            setSuccess(true)
            setTimeout(() => {
              router.push(
                `/payment/success?registration=${encodeURIComponent(registration)}&transactionId=${encodeURIComponent(json?.transactionId || "")}`,
              )
            }, 1200)
          } catch {
            setError("Payment verification failed. Please try again.")
            setLoading(false)
          }
        },
      })

      rzp.on("payment.failed", (resp: any) => {
        const msg = resp?.error?.description || resp?.error?.reason || "Payment failed. Please try again."
        setError(msg)
        setLoading(false)
      })

      rzp.open()
    } catch (e: any) {
      setError(e?.message || "Unable to start payment. Please try again.")
      setLoading(false)
    }
  }

  const handleCashfreePayment = async () => {
    setLoading(true)
    setError("")
    setInfo("")

    if (!registration) {
      setError("Missing registration number.")
      setLoading(false)
      return
    }

    if (!enableCashfree) {
      setError("Cashfree is not enabled.")
      setLoading(false)
      return
    }

    if (!isAuthenticated && (!guestEmail.trim() || !guestPhone.trim())) {
      setError("Please enter your email and phone number.")
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/cashfree/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purpose: "download",
          registrationNumber: registration,
          guest: isGuest,
          customerName: isAuthenticated ? user?.name : guestName || "Guest",
          customerEmail: isAuthenticated ? user?.email : guestEmail,
          customerPhone: isAuthenticated ? cashfreePhone || undefined : guestPhone,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || "Unable to start payment. Please try again.")
        setLoading(false)
        return
      }

      const cashfree = await loadCashfree(json?.mode || config?.cashfreeMode || "sandbox")
      if (!cashfree) throw new Error("Cashfree failed to load")

      await cashfree.checkout({
        paymentSessionId: json.paymentSessionId,
        redirectTarget: "_self",
      } as any)
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
                      <span className="text-muted-foreground">Registration Number</span>
                      <span className="font-medium">{registration}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Vehicle RC Download</span>
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
                        disabled={loading || Boolean(isAuthenticated && user && user.walletBalance < price)}
                      >
                        {loading ? "Processing..." : `Pay ${formatInr(price, { maximumFractionDigits: 0 })}`}
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
                <>
                  {!enableRazorpay && !enableManualUpi && !enableCashfree && (
                    <Card className="border-primary/40">
                      <CardHeader>
                        <CardTitle>Payments Temporarily Unavailable</CardTitle>
                        <CardDescription>We’re upgrading payments. Please login to pay from your wallet.</CardDescription>
                      </CardHeader>
                      <CardFooter>
                        <Button className="w-full" size="lg" onClick={() => router.push("/login")}>
                          Login
                        </Button>
                      </CardFooter>
                    </Card>
                  )}

                  {enableCashfree && (
                    <Card className="border-primary">
                      <CardHeader>
                        <CardTitle>Pay with Cashfree</CardTitle>
                        <CardDescription>UPI, Cards, NetBanking</CardDescription>
                      </CardHeader>
                      {!isAuthenticated ? (
                        <CardContent className="space-y-4">
                          <div className="grid gap-3">
                            <div className="space-y-1">
                              <Label htmlFor="guestName">Name (optional)</Label>
                              <Input id="guestName" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="guestEmail">Email</Label>
                              <Input
                                id="guestEmail"
                                type="email"
                                value={guestEmail}
                                onChange={(e) => setGuestEmail(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="guestPhone">Phone</Label>
                              <Input
                                id="guestPhone"
                                inputMode="tel"
                                value={guestPhone}
                                onChange={(e) => setGuestPhone(e.target.value)}
                              />
                            </div>
                          </div>
                        </CardContent>
                      ) : (
                        <CardContent className="space-y-3">
                          <div className="space-y-1">
                            <Label htmlFor="cashfreePhone">Phone (if not saved)</Label>
                            <Input
                              id="cashfreePhone"
                              inputMode="tel"
                              placeholder="Enter phone only if Cashfree asks for it"
                              value={cashfreePhone}
                              onChange={(e) => setCashfreePhone(e.target.value)}
                            />
                          </div>
                        </CardContent>
                      )}
                      <CardFooter>
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={handleCashfreePayment}
                          disabled={loading || !registration || Boolean(manualTxn)}
                        >
                          {loading ? "Opening..." : `Pay ${formatInr(price, { maximumFractionDigits: 0 })}`}
                        </Button>
                      </CardFooter>
                    </Card>
                  )}

                  {enableRazorpay && (
                    <Card className="border-primary">
                      <CardHeader>
                        <CardTitle>Pay with Razorpay</CardTitle>
                        <CardDescription>Cards, UPI, NetBanking, Wallets</CardDescription>
                      </CardHeader>
                      <CardFooter>
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={handleRazorpayPayment}
                          disabled={loading || !registration || Boolean(manualTxn)}
                        >
                          {loading ? "Opening..." : `Pay INR ${price}`}
                        </Button>
                      </CardFooter>
                    </Card>
                  )}

                  {enableManualUpi && <Card className="border-primary/40">
                    <CardHeader>
                      <CardTitle>Pay via UPI (Manual)</CardTitle>
                      <CardDescription>Scan QR or use the UPI ID</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div ref={proofRef} className="space-y-4">
                        {!config?.upiId ? (
                          <Alert variant="destructive">
                            <AlertDescription>
                              UPI is not configured. Set `PAYMENT_UPI_ID` in your environment.
                            </AlertDescription>
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

                        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                          <div className="font-medium">Payment Details</div>
                          <div className="text-muted-foreground">Amount: ₹{price}</div>
                          <div className="text-muted-foreground">Registration: {registration}</div>
                          <div className="text-muted-foreground">User: {isAuthenticated ? user?.name || "-" : "Guest"}</div>
                          <div className="text-muted-foreground">
                            User ID: {isAuthenticated ? user?.id || "-" : "N/A"}
                          </div>
                          {manualTxn?.transactionId && (
                            <div className="text-muted-foreground">Transaction ID: {manualTxn.transactionId}</div>
                          )}
                        </div>
                      </div>

                      {shareError && (
                        <Alert variant="destructive">
                          <AlertDescription>{shareError}</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                      {manualTxn ? (
                        <>
                          <Button className="w-full" size="lg" onClick={() => sendWhatsAppProof(manualTxn.transactionId)} disabled={sharing}>
                            {sharing ? "Opening WhatsApp..." : "Send Screenshot to WhatsApp"}
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full bg-transparent"
                            onClick={() => finishUpiFlow(manualTxn.transactionId)}
                          >
                            Continue
                          </Button>
                        </>
                      ) : (
                        <Button className="w-full" size="lg" onClick={handleUpiManualPayment} disabled={loading || !registration}>
                          {loading ? "Saving..." : "I've Paid"}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>}
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

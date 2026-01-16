"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { loadRazorpayCheckout } from "@/lib/razorpay-client"
import { loadCashfree } from "@/lib/cashfree-client"
import { shareManualPaymentProof } from "@/lib/manual-payment-proof"
import { MIN_WALLET_RECHARGE_INR } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Wallet, QrCode, Smartphone, CreditCard, CheckCircle2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000]

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

function phoneDigits(value: string) {
  return (value || "").replace(/\D/g, "")
}

export default function WalletRechargePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, refreshUser } = useAuth()

  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [error, setError] = useState("")
  const [manualTxn, setManualTxn] = useState<{ transactionId: string; status: string } | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState("")
  const [cashfreePhone, setCashfreePhone] = useState("")
  const proofRef = useRef<HTMLDivElement | null>(null)
  const amountPrefillRef = useRef(false)

  const savedPhoneDigits = phoneDigits(user?.phone || "")
  const hasSavedPhone = savedPhoneDigits.length >= 10 && savedPhoneDigits.length <= 15
  const maskedSavedPhone = hasSavedPhone
    ? `${"*".repeat(Math.max(0, savedPhoneDigits.length - 4))}${savedPhoneDigits.slice(-4)}`
    : ""

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  useEffect(() => {
    if (amountPrefillRef.current) return
    const amountParam = searchParams.get("amount")
    if (amountParam) {
      const parsed = Number.parseFloat(amountParam)
      if (Number.isFinite(parsed) && parsed > 0) {
        const normalized = Math.max(MIN_WALLET_RECHARGE_INR, Math.ceil(parsed))
        setAmount(normalized.toString())
      }
    }
    amountPrefillRef.current = true
  }, [searchParams])

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

  const enableRazorpay = Boolean(config?.enableRazorpay)
  const enableManualUpi = Boolean(config?.enableManualUpi)
  const enableCashfree = Boolean(config?.enableCashfree)
  const anyPaymentEnabled = enableCashfree || enableRazorpay || enableManualUpi

  const numericAmount = useMemo(() => Number.parseFloat(amount || "0"), [amount])

  const upiUri = useMemo(() => {
    if (!config?.upiId || !numericAmount) return ""
    return buildUpiUri(config.upiId, config.payeeName, numericAmount, "Wallet Recharge")
  }, [config, numericAmount])

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

  const handlePaymentClick = () => {
    setError("")
    if (!numericAmount || numericAmount <= 0) return
    if (numericAmount < MIN_WALLET_RECHARGE_INR) {
      setError(`Minimum recharge amount is INR ${MIN_WALLET_RECHARGE_INR}.`)
      return
    }
    if (config && !anyPaymentEnabled) {
      setError("Wallet recharge is temporarily unavailable while we upgrade payments.")
      return
    }
    setManualTxn(null)
    setShareError("")
    if (enableCashfree && hasSavedPhone) {
      void handleCashfreeRecharge()
      return
    }
    setShowPaymentModal(true)
  }

  const finishRechargeFlow = (status: string) => {
    setShowPaymentModal(false)
    setSuccess(true)

    setTimeout(() => {
      router.push(status === "completed" ? "/dashboard" : "/transactions")
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
    const message = [
      "Manual wallet recharge",
      `User: ${user?.name || "-"}`,
      `User ID: ${user?.id || "-"}`,
      `Amount: ₹${numericAmount}`,
      transactionId ? `Transaction ID: ${transactionId}` : "",
      `Time: ${now}`,
    ]
      .filter(Boolean)
      .join("\n")

    const result = await shareManualPaymentProof({
      adminNumber,
      message,
      screenshotEl: proofRef.current,
      filename: transactionId ? `recharge-${transactionId}.png` : undefined,
    })

    setSharing(false)
    if (!result.ok) {
      setShareError("Couldn't open WhatsApp. Please send the screenshot manually.")
    }
  }

  const handleConfirmPaid = async () => {
    if (numericAmount < MIN_WALLET_RECHARGE_INR) {
      setError(`Minimum recharge amount is INR ${MIN_WALLET_RECHARGE_INR}.`)
      return
    }
    setLoading(true)
    setError("")
    const res = await fetch("/api/wallet/recharge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: numericAmount }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || "Failed to create recharge request")
      setLoading(false)
      return
    }

    await refreshUser()
    setLoading(false)
    setManualTxn({ transactionId: json?.transactionId || "", status: json?.status || "pending" })
    await sendWhatsAppProof(json?.transactionId).catch(() => {})
  }

  const handleRazorpayRecharge = async () => {
    if (numericAmount < MIN_WALLET_RECHARGE_INR) {
      setError(`Minimum recharge amount is INR ${MIN_WALLET_RECHARGE_INR}.`)
      return
    }
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "recharge", amount: numericAmount }),
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
            setLoading(false)
            setShowPaymentModal(false)
            setSuccess(true)

            setTimeout(() => {
              router.push("/dashboard")
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

  const handleCashfreeRecharge = async () => {
    if (numericAmount < MIN_WALLET_RECHARGE_INR) {
      setError(`Minimum recharge amount is INR ${MIN_WALLET_RECHARGE_INR}.`)
      return
    }
    setLoading(true)
    setError("")

    if (!enableCashfree) {
      setError("Cashfree is not enabled.")
      setLoading(false)
      return
    }

    const effectivePhoneDigits = hasSavedPhone ? savedPhoneDigits : phoneDigits(cashfreePhone)
    const digits = effectivePhoneDigits
    if (digits.length < 10 || digits.length > 15) {
      setError("Please enter a valid phone number.")
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/cashfree/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purpose: "recharge",
          amount: numericAmount,
          customerPhone: effectivePhoneDigits || undefined,
          customerEmail: user?.email || undefined,
          customerName: user?.name || undefined,
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

      await cashfree.checkout(
        {
          paymentSessionId: json.paymentSessionId,
          redirectTarget: "_self",
        } as any,
      )
    } catch (e: any) {
      setError(e?.message || "Unable to start payment. Please try again.")
      setLoading(false)
    }
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-blue-50/30 to-background">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Recharge Wallet</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {success ? (
            <Card className="border-green-200 bg-green-50 shadow-lg">
              <CardContent className="pt-6 text-center space-y-3">
                <div className="mx-auto p-3 bg-green-100 rounded-full w-fit">
                  <Wallet className="h-8 w-8 text-green-700" />
                </div>
                <div className="text-xl font-bold text-green-900">Recharge request created</div>
                <div className="text-sm text-green-800">
                  {config?.autoApprove ? "Wallet updated." : "Pending confirmation. You can track it in Transactions."}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Wallet className="h-6 w-6" />
                  Add Money
                </CardTitle>
                <CardDescription>Recharge your wallet</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {config && !anyPaymentEnabled && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription className="text-blue-900">
                      Wallet recharge is temporarily unavailable while we upgrade payments.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-3">
                  <Label className="text-base">Choose Amount</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {PRESET_AMOUNTS.map((presetAmount) => (
                      <Button
                        key={presetAmount}
                        variant={amount === presetAmount.toString() ? "default" : "outline"}
                        className={amount === presetAmount.toString() ? "h-12" : "h-12 bg-transparent"}
                        onClick={() => setAmount(presetAmount.toString())}
                      >
                        ₹{presetAmount}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-base">
                    Custom Amount (₹)
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-12 text-lg"
                    min={MIN_WALLET_RECHARGE_INR}
                    step="1"
                  />
                  <p className="text-xs text-muted-foreground">Minimum recharge amount is INR {MIN_WALLET_RECHARGE_INR}.</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full h-14 text-lg"
                  size="lg"
                  onClick={handlePaymentClick}
                  disabled={
                    loading ||
                    !numericAmount ||
                    numericAmount < MIN_WALLET_RECHARGE_INR ||
                    (config !== null && !anyPaymentEnabled)
                  }
                >
                  <CreditCard className="h-5 w-5 mr-3" />
                  {loading && enableCashfree && hasSavedPhone
                    ? "Opening Cashfree..."
                    : `Continue to Pay ₹${amount || "0"}`}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>

      <Dialog
        open={showPaymentModal}
        onOpenChange={(open) => {
          setShowPaymentModal(open)
          if (!open) {
            setManualTxn(null)
            setShareError("")
            setSharing(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Complete Payment</DialogTitle>
            <DialogDescription className="text-base">Pay ₹{amount} to recharge your wallet</DialogDescription>
          </DialogHeader>

          {!manualTxn && (enableCashfree || enableRazorpay) && (
            <div className="space-y-3">
              {enableCashfree && (
                <div className="space-y-2">
                  {!hasSavedPhone ? (
                    <div className="space-y-1">
                      <Label htmlFor="cashfreePhone">Phone (needed for Cashfree)</Label>
                      <Input
                        id="cashfreePhone"
                        inputMode="tel"
                        placeholder="Enter phone number"
                        value={cashfreePhone}
                        onChange={(e) => setCashfreePhone(e.target.value)}
                        className="h-11"
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>
                          Using saved mobile for Cashfree: <span className="font-mono">{maskedSavedPhone}</span>
                        </span>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={handleCashfreeRecharge}
                    disabled={loading || !numericAmount || numericAmount < MIN_WALLET_RECHARGE_INR}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? "Opening..." : "Pay with Cashfree"}
                  </Button>
                </div>
              )}
              {enableRazorpay && (
                <Button
                  onClick={handleRazorpayRecharge}
                  disabled={loading || !numericAmount || numericAmount < MIN_WALLET_RECHARGE_INR}
                  className="w-full"
                  size="lg"
                >
                  {loading ? "Opening..." : "Pay with Razorpay"}
                </Button>
              )}
              {enableManualUpi && <div className="text-xs text-muted-foreground text-center">or pay via UPI (manual)</div>}
            </div>
          )}

          {enableManualUpi ? (
            !config?.upiId ? (
            <Alert variant="destructive">
              <AlertDescription>UPI is not configured. Set `PAYMENT_UPI_ID` in your environment.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4 py-2">
              <div ref={proofRef} className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="font-medium">UPI ID</div>
                  <div className="font-mono break-all">{config.upiId}</div>
                  {config.payeeName && <div className="text-muted-foreground mt-1">Payee: {config.payeeName}</div>}
                </div>

                {isMobile ? (
                  <Button className="w-full" size="lg" asChild>
                    <a href={upiUri || "#"}>Open UPI App</a>
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
                          <Smartphone className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                  <div className="font-medium">Payment Details</div>
                  <div className="text-muted-foreground">Amount: ₹{numericAmount}</div>
                  <div className="text-muted-foreground">User: {user?.name || "-"}</div>
                  <div className="text-muted-foreground">User ID: {user?.id || "-"}</div>
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

              {manualTxn ? (
                <div className="space-y-2">
                  <Button
                    onClick={() => sendWhatsAppProof(manualTxn.transactionId)}
                    disabled={sharing}
                    className="w-full"
                    size="lg"
                  >
                    {sharing ? "Opening WhatsApp..." : "Send Screenshot to WhatsApp"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    onClick={() => finishRechargeFlow(manualTxn.status)}
                  >
                    Continue
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleConfirmPaid}
                  disabled={loading || !numericAmount || numericAmount < MIN_WALLET_RECHARGE_INR}
                  className="w-full"
                  size="lg"
                >
                  {loading ? "Saving..." : "I've Paid (Manual)"}
                </Button>
              )}
              {!config.autoApprove && (
                <p className="text-xs text-muted-foreground">
                  Recharge will show as pending until confirmed by admin.
                </p>
              )}
            </div>
          )
          ) : !enableCashfree && !enableRazorpay ? (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-900">
                Wallet recharge is temporarily unavailable while we upgrade payments.
              </AlertDescription>
            </Alert>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

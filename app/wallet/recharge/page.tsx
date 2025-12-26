"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Wallet, QrCode, Smartphone, CreditCard } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000]

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

export default function WalletRechargePage() {
  const router = useRouter()
  const { isAuthenticated, refreshUser } = useAuth()

  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

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
      .catch(() => setConfig({ upiId: "", payeeName: "", qrUrl: "", autoApprove: false }))
  }, [])

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
    setShowPaymentModal(true)
  }

  const handleConfirmPaid = async () => {
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
    setShowPaymentModal(false)
    setSuccess(true)

    setTimeout(() => {
      router.push(json?.status === "completed" ? "/dashboard" : "/transactions")
    }, 1200)
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
                <CardDescription>Pay via UPI (QR / UPI ID)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
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
                    min="1"
                    step="1"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full h-14 text-lg"
                  size="lg"
                  onClick={handlePaymentClick}
                  disabled={!numericAmount || numericAmount <= 0}
                >
                  <CreditCard className="h-5 w-5 mr-3" />
                  Continue to Pay ₹{amount || "0"}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Pay via UPI</DialogTitle>
            <DialogDescription className="text-base">Pay ₹{amount} to recharge your wallet</DialogDescription>
          </DialogHeader>

          {!config?.upiId ? (
            <Alert variant="destructive">
              <AlertDescription>UPI is not configured. Set `PAYMENT_UPI_ID` in your environment.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4 py-2">
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

              <Button onClick={handleConfirmPaid} disabled={loading} className="w-full" size="lg">
                {loading ? "Saving..." : "I've Paid"}
              </Button>
              {!config.autoApprove && (
                <p className="text-xs text-muted-foreground">
                  Recharge will show as pending until confirmed by admin.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

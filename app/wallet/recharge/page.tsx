"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { MIN_WALLET_RECHARGE_INR } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Wallet, CreditCard, CheckCircle2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000]

type PaymentConfig = {
  enableFinvedex: boolean
}

function phoneDigits(value: string) {
  return (value || "").replace(/\D/g, "")
}

export default function WalletRechargePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated } = useAuth()

  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [error, setError] = useState("")
  const [finvedexPhone, setFinvedexPhone] = useState("")
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
    fetch("/api/payment/config")
      .then((r) => r.json())
      .then((c) => setConfig(c))
      .catch(() => setConfig({ enableFinvedex: false }))
  }, [])

  const enableFinvedex = Boolean(config?.enableFinvedex)
  const numericAmount = Number.parseFloat(amount || "0")

  const handlePaymentClick = () => {
    setError("")
    if (!numericAmount || numericAmount <= 0) return
    if (numericAmount < MIN_WALLET_RECHARGE_INR) {
      setError(`Minimum recharge amount is INR ${MIN_WALLET_RECHARGE_INR}.`)
      return
    }
    if (config && !enableFinvedex) {
      setError("Wallet recharge is temporarily unavailable while we upgrade payments.")
      return
    }
    setShowPaymentModal(true)
  }

  const handleFinvedexRecharge = async () => {
    if (numericAmount < MIN_WALLET_RECHARGE_INR) {
      setError(`Minimum recharge amount is INR ${MIN_WALLET_RECHARGE_INR}.`)
      return
    }
    setLoading(true)
    setError("")

    const phone = phoneDigits(finvedexPhone) || savedPhoneDigits
    if (!phone || phone.length < 10 || phone.length > 15) {
      setError("Please enter a valid 10-digit mobile number.")
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/finvedex/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "recharge", amount: numericAmount, customerPhone: phone }),
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
                <div className="text-xl font-bold text-green-900">Recharge initiated</div>
                <div className="text-sm text-green-800">Your wallet will be updated after payment confirmation.</div>
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
                {config && !enableFinvedex && (
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
                    (config !== null && !enableFinvedex)
                  }
                >
                  <CreditCard className="h-5 w-5 mr-3" />
                  {`Continue to Pay ₹${amount || "0"}`}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>

      <Dialog
        open={showPaymentModal}
        onOpenChange={(open) => {
          if (!open) setLoading(false)
          setShowPaymentModal(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Complete Payment</DialogTitle>
            <DialogDescription className="text-base">Pay ₹{amount} to recharge your wallet</DialogDescription>
          </DialogHeader>

          {enableFinvedex ? (
            <div className="space-y-4 py-2">
              {hasSavedPhone ? (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>
                      Using saved mobile: <span className="font-mono">{maskedSavedPhone}</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="finvedexPhone">Mobile Number (required)</Label>
                  <Input
                    id="finvedexPhone"
                    inputMode="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={finvedexPhone}
                    onChange={(e) => setFinvedexPhone(e.target.value)}
                    className="h-11"
                  />
                </div>
              )}
              <Button
                onClick={handleFinvedexRecharge}
                disabled={loading || !numericAmount || numericAmount < MIN_WALLET_RECHARGE_INR}
                className="w-full"
                size="lg"
              >
                {loading ? "Opening..." : "Pay with Finvedex"}
              </Button>
            </div>
          ) : (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-900">
                Wallet recharge is temporarily unavailable while we upgrade payments.
              </AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

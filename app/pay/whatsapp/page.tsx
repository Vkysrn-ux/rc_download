"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

const SERVICE_ICONS: Record<string, string> = {
  rc: "🚗",
  pan: "📋",
  mobile: "📱",
  owner: "👤",
}

function WhatsappPayContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id") || ""

  const [details, setDetails] = useState<{
    label: string
    service: string
    query: string
    amount: number
    status: string
    phone: string
  } | null>(null)
  const [error, setError] = useState("")
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    if (!id) { setError("Invalid payment link."); return }
    fetch(`/api/whatsapp/pay?id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(json => {
        if (!json.ok) setError(json.error || "Request not found.")
        else if (json.status !== "pending") setError("This payment link has already been used.")
        else setDetails(json)
      })
      .catch(() => setError("Failed to load payment details."))
  }, [id])

  async function handlePay() {
    if (!id || paying) return
    setPaying(true)
    try {
      const res = await fetch("/api/whatsapp/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (!json.ok || !json.paymentUrl) {
        setError(json.error || "Failed to create payment. Please try again.")
        setPaying(false)
        return
      }
      window.location.href = json.paymentUrl
    } catch {
      setError("Network error. Please try again.")
      setPaying(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  const icon = SERVICE_ICONS[details.service] || "📄"

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="text-5xl mb-2">{icon}</div>
          <CardTitle>{details.label}</CardTitle>
          <CardDescription>
            {details.query} · WhatsApp {details.phone}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">Amount to pay</p>
            <p className="text-3xl font-bold text-blue-700">₹{details.amount}</p>
          </div>

          <div className="text-sm text-gray-600 text-center space-y-1">
            <p>Pay using PhonePe, GPay, Paytm, or any UPI app.</p>
            <p>Your document will be sent to WhatsApp automatically after payment.</p>
          </div>

          <Button
            className="w-full text-lg py-6"
            onClick={handlePay}
            disabled={paying}
          >
            {paying ? "Redirecting to payment…" : `Pay ₹${details.amount} Now`}
          </Button>

          <p className="text-xs text-center text-gray-400">
            Secure payment powered by vehiclercdownload.com
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function WhatsappPayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    }>
      <WhatsappPayContent />
    </Suspense>
  )
}

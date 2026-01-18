"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

function CashfreeReturnContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const transactionId = searchParams.get("transactionId") || ""
  const registration = searchParams.get("registration") || ""
  const purpose = searchParams.get("purpose") || ""
  const pan = searchParams.get("pan") || ""
  const isRecharge = searchParams.get("recharge") === "1" || searchParams.get("recharge") === "true"

  const [error, setError] = useState("")
  const [paymentState, setPaymentState] = useState<"verifying" | "completed" | "failed" | "cancelled" | "pending">("verifying")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!transactionId) {
      setError("Missing transactionId.")
      return
    }

    let cancelled = false
    async function run() {
      setError("")
      const res = await fetch("/api/cashfree/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transactionId }),
      })
      const json = await res.json().catch(() => ({}))
      if (cancelled) return
      if (!res.ok) {
        const status = json?.status || "failed"
        const err = json?.error || "Payment verification failed."
        setMessage(err)
        // treat cancellations/failures specially
        if (String(err).toLowerCase().includes("cancel") || String(status).toLowerCase() === "failed") {
          setPaymentState("cancelled")
        } else if (String(status).toLowerCase() === "pending") {
          setPaymentState("pending")
        } else {
          setPaymentState("failed")
        }
        setError(err)
        return
      }

      // success
      setPaymentState("completed")
      if (isRecharge) {
        router.replace("/dashboard")
        return
      }

      if (purpose === "pan_details" && pan) {
        router.replace(
          `/services?purpose=pan_details&pan=${encodeURIComponent(pan)}&transactionId=${encodeURIComponent(transactionId)}`,
        )
        return
      }

      if ((purpose === "rc_to_mobile" || purpose === "rc_owner_history") && registration) {
        router.replace(
          `/services?purpose=${encodeURIComponent(purpose)}&registration=${encodeURIComponent(registration)}&transactionId=${encodeURIComponent(transactionId)}`,
        )
        return
      }

      // Default: redirect back to home with params so the Guest Access card can show download actions inline.
      if (registration) {
        router.replace(`/?registration=${encodeURIComponent(registration)}&transactionId=${encodeURIComponent(transactionId)}`)
        return
      }

      router.replace(`/transactions`)
    }

    run().catch(() => {
      if (!cancelled) setError("Payment verification failed.")
    })

    return () => {
      cancelled = true
    }
  }, [isRecharge, registration, router, transactionId])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <div className="max-w-xl mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>Verifying Payment</CardTitle>
            <CardDescription>Please wait while we confirm your payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentState === "verifying" && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-900">Do not close this page.</AlertDescription>
              </Alert>
            )}

            {paymentState === "completed" && (
              <Alert>
                <AlertDescription>Payment successful. Redirecting…</AlertDescription>
              </Alert>
            )}

            {paymentState === "pending" && (
              <Alert>
                <AlertDescription>Payment is still pending. You can check Transactions later.</AlertDescription>
              </Alert>
            )}

            {paymentState === "failed" && (
              <Alert variant="destructive">
                <AlertDescription>{message || "Payment failed."}</AlertDescription>
              </Alert>
            )}

            {paymentState === "cancelled" && (
              <div className="space-y-3">
                <Alert variant="destructive">
                  <AlertDescription>Transaction cancelled.</AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button onClick={() => router.replace("/")}>Go Home</Button>
                  <Button variant="outline" onClick={() => router.replace(`/transactions`)}>
                    View Transactions
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function CashfreeReturnPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CashfreeReturnContent />
    </Suspense>
  )
}

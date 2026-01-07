"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

function CashfreeReturnContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const transactionId = searchParams.get("transactionId") || ""
  const registration = searchParams.get("registration") || ""
  const isRecharge = searchParams.get("recharge") === "1" || searchParams.get("recharge") === "true"

  const [error, setError] = useState("")

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
        setError(json?.error || "Payment verification failed.")
        return
      }

      if (isRecharge) {
        router.replace("/dashboard")
        return
      }

      // Redirect back to home with params so the Guest Access card can show download actions inline.
      if (!registration) {
        router.replace(`/transactions`)
        return
      }

      router.replace(
        `/?registration=${encodeURIComponent(registration)}&transactionId=${encodeURIComponent(transactionId)}`,
      )
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
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-900">Do not close this page.</AlertDescription>
              </Alert>
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


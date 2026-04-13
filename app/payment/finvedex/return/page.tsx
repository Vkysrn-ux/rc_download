"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

function FinvedexReturnContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const transactionId = searchParams.get("transactionId") || ""
  const purpose = searchParams.get("purpose") || ""
  const registration = searchParams.get("registration") || ""
  const pan = searchParams.get("pan") || ""

  // Finvedex may append status/txn params to the redirect URL
  const statusParam = (
    searchParams.get("status") ||
    searchParams.get("payment_status") ||
    searchParams.get("txn_status") ||
    ""
  ).toLowerCase()

  const [state, setState] = useState<"verifying" | "completed" | "failed" | "pending">("verifying")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!transactionId) {
      setState("failed")
      setMessage("Missing transaction information.")
      return
    }

    // If Finvedex passed an explicit failure status, show it immediately
    if (statusParam === "failed" || statusParam === "failure" || statusParam === "cancelled") {
      setState("failed")
      setMessage("Payment was not completed. Please try again.")
      return
    }

    // Poll our DB to check if the webhook already marked it completed,
    // or if Finvedex passed a success status directly in the redirect URL.
    async function verify() {
      try {
        const res = await fetch(`/api/finvedex/verify?transactionId=${encodeURIComponent(transactionId)}`)
        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          setState("failed")
          setMessage(json?.error || "Payment verification failed.")
          return
        }

        const txnStatus = String(json?.status || "").toLowerCase()

        if (txnStatus === "completed") {
          setState("completed")
          redirect()
        } else if (txnStatus === "failed") {
          setState("failed")
          setMessage("Payment failed. Please try again.")
        } else {
          // Still pending — webhook may arrive shortly, poll again
          setState("pending")
          setTimeout(() => verify(), 4000)
        }
      } catch {
        setState("failed")
        setMessage("Verification error. Please contact support.")
      }
    }

    verify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId])

  const redirect = () => {
    if (purpose === "recharge") {
      router.replace("/dashboard")
    } else if (purpose === "pan_details" && pan) {
      router.replace(`/services?purpose=pan_details&pan=${encodeURIComponent(pan)}&transactionId=${encodeURIComponent(transactionId)}`)
    } else if (purpose === "rc_to_mobile" && registration) {
      router.replace(`/services?purpose=rc_to_mobile&registration=${encodeURIComponent(registration)}&transactionId=${encodeURIComponent(transactionId)}`)
    } else if (purpose === "rc_owner_history" && registration) {
      router.replace(`/services?purpose=rc_owner_history&registration=${encodeURIComponent(registration)}&transactionId=${encodeURIComponent(transactionId)}`)
    } else if (registration) {
      router.replace(`/payment/success?registration=${encodeURIComponent(registration)}&transactionId=${encodeURIComponent(transactionId)}`)
    } else {
      router.replace("/transactions")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <div className="max-w-xl mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>Verifying Payment</CardTitle>
            <CardDescription>Please wait while we confirm your payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {state === "verifying" && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-900">Checking payment status… Do not close this page.</AlertDescription>
              </Alert>
            )}
            {state === "pending" && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertDescription className="text-yellow-900">Payment received — waiting for confirmation. Please wait…</AlertDescription>
              </Alert>
            )}
            {state === "completed" && (
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="text-green-900">Payment confirmed! Redirecting…</AlertDescription>
              </Alert>
            )}
            {state === "failed" && (
              <div className="space-y-3">
                <Alert variant="destructive">
                  <AlertDescription>{message || "Payment failed."}</AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button onClick={() => router.replace("/")}>Go Home</Button>
                  <Button variant="outline" onClick={() => router.replace("/transactions")}>View Transactions</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function FinvedexReturnPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <FinvedexReturnContent />
    </Suspense>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle")
  const [message, setMessage] = useState<string>("")

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!token) {
        setStatus("error")
        setMessage("Missing verification token.")
        return
      }

      setStatus("verifying")
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const json = await res.json().catch(() => ({}))
      if (cancelled) return

      if (!res.ok) {
        setStatus("error")
        setMessage(json?.error || "Verification failed.")
        return
      }

      setStatus("success")
      setMessage("Email verified successfully. You can now log in.")
      setTimeout(() => router.push("/login?verified=1"), 1200)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [token, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify Email</CardTitle>
          <CardDescription>Confirming your email address…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "verifying" && (
            <Alert>
              <AlertDescription>Verifying…</AlertDescription>
            </Alert>
          )}
          {status === "success" && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">{message}</AlertDescription>
            </Alert>
          )}
          {status === "error" && (
            <Alert variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <Button className="w-full" onClick={() => router.push("/login")} variant="outline">
            Go to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}


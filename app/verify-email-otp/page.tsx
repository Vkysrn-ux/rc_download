"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function VerifyEmailOtpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get("email") || ""

  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [info, setInfo] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    setEmail(initialEmail)
  }, [initialEmail])

  const requestOtp = async () => {
    setSending(true)
    setError("")
    setInfo("")
    const res = await fetch("/api/auth/verify-email-otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || "Failed to send OTP")
      setSending(false)
      return
    }
    if (json?.alreadyVerified) {
      setInfo("Email is already verified. You can log in.")
      setSending(false)
      return
    }
    if (typeof json?.debugOtp === "string") setOtp(json.debugOtp)
    setInfo("Verification OTP sent to your email (valid for 10 minutes).")
    setSending(false)
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setInfo("")

    const res = await fetch("/api/auth/verify-email-otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, otp }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || "Verification failed")
      setLoading(false)
      return
    }

    setInfo("Email verified successfully. Redirecting to login…")
    setLoading(false)
    setTimeout(() => router.push("/login?verified=1"), 900)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Verify Email</CardTitle>
          <CardDescription className="text-center">Enter the OTP sent to your email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <Button type="button" variant="outline" className="w-full bg-transparent" onClick={requestOtp} disabled={sending || !email}>
            {sending ? "Sending..." : "Send / Resend OTP"}
          </Button>

          <form onSubmit={verify} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="otp">OTP</Label>
              <Input
                id="otp"
                inputMode="numeric"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !email || otp.length !== 6}>
              {loading ? "Verifying..." : "Verify Email"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="ghost" onClick={() => router.push("/login")}>
            Back to Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

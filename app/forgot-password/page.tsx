"use client"

import type React from "react"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialIdentifier = useMemo(() => searchParams.get("identifier") || "", [searchParams])

  const [identifier, setIdentifier] = useState(initialIdentifier)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [info, setInfo] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  const requestOtp = async () => {
    setSending(true)
    setError("")
    setInfo("")
    setOtp("")

    const res = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: identifier.trim() }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || "Failed to send reset code")
      setSending(false)
      return
    }

    setOtpSent(true)
    if (typeof json?.debugOtp === "string") setOtp(json.debugOtp)
    setInfo("If an account exists, a reset code has been sent to the email address on file (valid for 10 minutes).")
    setSending(false)
  }

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setInfo("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setLoading(false)
      return
    }

    const res = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: identifier.trim(), otp, password }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || "Password reset failed")
      setLoading(false)
      return
    }

    setInfo("Password updated. Redirecting to login…")
    setLoading(false)
    setTimeout(() => router.push("/login?reset=1"), 800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Forgot Password</CardTitle>
          <CardDescription className="text-center">Enter your email or mobile number to reset your password</CardDescription>
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
            <Label htmlFor="identifier">Email or Mobile</Label>
            <Input
              id="identifier"
              placeholder="you@example.com or +91XXXXXXXXXX"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>

          <Button type="button" variant="outline" className="w-full bg-transparent" onClick={requestOtp} disabled={sending || !identifier.trim()}>
            {sending ? "Sending..." : otpSent ? "Resend Code" : "Send Code"}
          </Button>

          {otpSent && (
            <form onSubmit={resetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\\D/g, "").slice(0, 6))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/login" className="text-primary hover:underline font-medium">
            Back to Login
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}


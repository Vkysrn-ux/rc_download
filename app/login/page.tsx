"use client"

import type React from "react"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileText } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, requestOtp, verifyOtp } = useAuth()

  const verified = useMemo(() => searchParams.get("verified") === "1", [searchParams])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [mode, setMode] = useState<"password" | "otp">("password")
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setInfo("")
    setLoading(true)

    const result = await login(email, password)
    if (result.ok) {
      router.push("/dashboard")
    } else {
      setError(result.error || "Login failed")
    }

    setLoading(false)
  }

  const handleSendOtp = async () => {
    setSendingOtp(true)
    setError("")
    setInfo("")
    setOtp("")

    const result = await requestOtp(email)
    if (!result.ok) {
      setError(result.error || "Failed to send OTP")
      setSendingOtp(false)
      return
    }

    setOtpSent(true)
    if (result.debugOtp) {
      setInfo(`OTP generated (dev): ${result.debugOtp} (valid for 10 minutes).`)
      setOtp(result.debugOtp)
    } else {
      setInfo("OTP sent to your email (valid for 10 minutes). If you don’t receive it, configure SMTP or check server logs.")
    }
    setSendingOtp(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setInfo("")

    const result = await verifyOtp(email, otp)
    if (result.ok) {
      router.push("/dashboard")
    } else {
      setError(result.error || "Invalid OTP")
    }

    setLoading(false)
  }

  const handleResendVerification = async () => {
    setResending(true)
    setInfo("")
    setError("")

    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    })

    if (res.ok) {
      setInfo("Verification email sent (check your inbox).")
    } else {
      const json = await res.json().catch(() => ({}))
      setError(json?.error || "Failed to resend verification email.")
    }

    setResending(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-blue-50/30 to-background p-4 py-12">
      <Card className="w-full max-w-md mx-auto shadow-xl">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="mx-auto p-3 bg-primary rounded-xl w-fit">
            <FileText className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold">Welcome Back</CardTitle>
          <CardDescription className="text-base">Login to access your RC download account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-5">
            <Button
              type="button"
              variant={mode === "password" ? "default" : "outline"}
              className={mode === "password" ? "flex-1" : "flex-1 bg-transparent"}
              onClick={() => {
                setMode("password")
                setError("")
                setInfo("")
              }}
            >
              Password
            </Button>
            <Button
              type="button"
              variant={mode === "otp" ? "default" : "outline"}
              className={mode === "otp" ? "flex-1" : "flex-1 bg-transparent"}
              onClick={() => {
                setMode("otp")
                setError("")
                setInfo("")
              }}
            >
              OTP
            </Button>
          </div>

          <form onSubmit={mode === "otp" ? handleVerifyOtp : handleLogin} className="space-y-5">
            {verified && (
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="text-green-800">Email verified. Please log in.</AlertDescription>
              </Alert>
            )}
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
              <Label htmlFor="email" className="text-base">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            {mode === "password" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-base">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-base" size="lg" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </Button>
                {error.toLowerCase().includes("not verified") && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-transparent"
                    onClick={handleResendVerification}
                    disabled={!email || resending}
                  >
                    {resending ? "Sending..." : "Resend verification email"}
                  </Button>
                )}
              </>
            ) : (
              <>
                {!otpSent ? (
                  <Button
                    type="button"
                    className="w-full h-11 text-base"
                    size="lg"
                    onClick={handleSendOtp}
                    disabled={!email || sendingOtp}
                  >
                    {sendingOtp ? "Sending OTP..." : "Send OTP"}
                  </Button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="otp" className="text-base">
                        OTP
                      </Label>
                      <Input
                        id="otp"
                        inputMode="numeric"
                        placeholder="6-digit code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        className="h-11"
                      />
                    </div>
                    <Button type="submit" className="w-full h-11 text-base" size="lg" disabled={loading}>
                      {loading ? "Verifying..." : "Verify & Login"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full bg-transparent"
                      onClick={() => {
                        setOtpSent(false)
                        setOtp("")
                        setInfo("")
                        setError("")
                      }}
                    >
                      Use password instead
                    </Button>
                  </>
                )}
              </>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3 pt-6">
          <div className="text-base text-center text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline font-semibold">
              Sign up
            </Link>
          </div>
          <div className="text-base text-center text-muted-foreground">
            <Link href="/" className="text-primary hover:underline font-semibold">
              Continue as guest
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

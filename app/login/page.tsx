"use client"

import type React from "react"

import { useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { getFirebaseClientAuth } from "@/lib/firebase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileText } from "lucide-react"
import { type ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, requestOtp, verifyOtp, loginWithPhoneIdToken } = useAuth()

  const verified = useMemo(() => searchParams.get("verified") === "1", [searchParams])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailOtp, setEmailOtp] = useState("")
  const [mode, setMode] = useState<"password" | "emailOtp" | "phoneOtp">("password")
  const [emailOtpSent, setEmailOtpSent] = useState(false)

  const [phone, setPhone] = useState("")
  const [phoneOtp, setPhoneOtp] = useState("")
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false)
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false)

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

  const handleSendEmailOtp = async () => {
    setSendingEmailOtp(true)
    setError("")
    setInfo("")
    setEmailOtp("")

    const result = await requestOtp(email)
    if (!result.ok) {
      setError(result.error || "Failed to send OTP")
      setSendingEmailOtp(false)
      return
    }

    setEmailOtpSent(true)
    if (result.debugOtp) {
      setInfo(`OTP generated (dev): ${result.debugOtp} (valid for 10 minutes).`)
      setEmailOtp(result.debugOtp)
    } else {
      setInfo("OTP sent to your email (valid for 10 minutes). If you don’t receive it, configure SMTP or check server logs.")
    }
    setSendingEmailOtp(false)
  }

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setInfo("")

    const result = await verifyOtp(email, emailOtp)
    if (result.ok) {
      router.push("/dashboard")
    } else {
      setError(result.error || "Invalid OTP")
    }

    setLoading(false)
  }

  const handleSendPhoneOtp = async () => {
    setSendingPhoneOtp(true)
    setError("")
    setInfo("")
    setPhoneOtp("")

    try {
      const auth = getFirebaseClientAuth()
      try {
        recaptchaRef.current?.clear()
      } catch {
        // ignore
      }
      recaptchaRef.current = null
      const el = document.getElementById("recaptcha-container-login")
      if (el) el.innerHTML = ""

      const size = process.env.NODE_ENV === "production" ? "invisible" : "normal"
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container-login", { size })

      const confirmation = await signInWithPhoneNumber(auth, phone, recaptchaRef.current)
      setPhoneConfirmation(confirmation)
      setPhoneOtpSent(true)
      setInfo("OTP sent to your phone (SMS).")
    } catch (err: any) {
      try {
        recaptchaRef.current?.clear()
      } catch {
        // ignore
      }
      recaptchaRef.current = null
      const message = err?.message || "Failed to send phone OTP"
      setError(typeof message === "string" ? message : "Failed to send phone OTP")
    } finally {
      setSendingPhoneOtp(false)
    }
  }

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setInfo("")

    try {
      if (!phoneConfirmation) {
        setError("Please request an OTP first.")
        setLoading(false)
        return
      }

      const credential = await phoneConfirmation.confirm(phoneOtp)
      const idToken = await credential.user.getIdToken()
      const result = await loginWithPhoneIdToken(idToken)
      if (result.ok) {
        router.push("/dashboard")
      } else {
        setError(result.error || "Phone login failed")
      }
    } catch (err: any) {
      const message = err?.message || "OTP verification failed"
      setError(typeof message === "string" ? message : "OTP verification failed")
    } finally {
      setLoading(false)
    }
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
                setEmailOtpSent(false)
                setPhoneOtpSent(false)
                setError("")
                setInfo("")
              }}
            >
              Password
            </Button>
            <Button
              type="button"
              variant={mode === "emailOtp" ? "default" : "outline"}
              className={mode === "emailOtp" ? "flex-1" : "flex-1 bg-transparent"}
              onClick={() => {
                setMode("emailOtp")
                setEmailOtpSent(false)
                setPhoneOtpSent(false)
                setError("")
                setInfo("")
              }}
            >
              Email OTP
            </Button>
            <Button
              type="button"
              variant={mode === "phoneOtp" ? "default" : "outline"}
              className={mode === "phoneOtp" ? "flex-1" : "flex-1 bg-transparent"}
              onClick={() => {
                setMode("phoneOtp")
                setEmailOtpSent(false)
                setPhoneOtpSent(false)
                setError("")
                setInfo("")
              }}
            >
              Phone OTP
            </Button>
          </div>

          <form
            onSubmit={
              mode === "emailOtp" ? handleVerifyEmailOtp : mode === "phoneOtp" ? handleVerifyPhoneOtp : handleLogin
            }
            className="space-y-5"
          >
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
            {mode === "phoneOtp" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-base">
                    Phone (E.164, e.g. +9198...)
                  </Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    placeholder="+91XXXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                {!phoneOtpSent ? (
                  <Button
                    type="button"
                    className="w-full h-11 text-base"
                    size="lg"
                    onClick={handleSendPhoneOtp}
                    disabled={!phone || sendingPhoneOtp}
                  >
                    {sendingPhoneOtp ? "Sending OTP..." : "Send OTP"}
                  </Button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="phoneOtp" className="text-base">
                        OTP
                      </Label>
                      <Input
                        id="phoneOtp"
                        inputMode="numeric"
                        placeholder="6-digit code"
                        value={phoneOtp}
                        onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                        setPhoneOtpSent(false)
                        setPhoneOtp("")
                        setInfo("")
                        setError("")
                      }}
                    >
                      Use another method
                    </Button>
                  </>
                )}
              </>
            ) : (
              <>
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
                {!emailOtpSent ? (
                  <Button
                    type="button"
                    className="w-full h-11 text-base"
                    size="lg"
                    onClick={handleSendEmailOtp}
                    disabled={!email || sendingEmailOtp}
                  >
                    {sendingEmailOtp ? "Sending OTP..." : "Send OTP"}
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
                        value={emailOtp}
                        onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                        setEmailOtpSent(false)
                        setEmailOtp("")
                        setInfo("")
                        setError("")
                      }}
                    >
                      Use another method
                    </Button>
                  </>
                )}
              </>
            )}
              </>
            )}
          </form>
          <div
            id="recaptcha-container-login"
            className={process.env.NODE_ENV === "production" ? "sr-only" : "flex justify-center"}
          />
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

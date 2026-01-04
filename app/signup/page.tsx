"use client"

import type React from "react"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { getFirebaseClientAuth } from "@/lib/firebase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { type ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth"

export default function SignupPage() {
  const router = useRouter()
  const { signup, loginWithPhoneIdToken } = useAuth()

  const [method, setMethod] = useState<"email" | "phone">("email")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [phoneOtp, setPhoneOtp] = useState("")
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [debugOtp, setDebugOtp] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setInfo("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)

    const result = await signup(name, email, password)
    if (!result.ok) {
      setError(result.error || "Signup failed")
      setLoading(false)
      return
    }

    if (result.debugOtp) setDebugOtp(result.debugOtp)
    setInfo("Account created. Please verify your email using the OTP sent to your email.")
    setLoading(false)
    setTimeout(() => router.push(`/verify-email-otp?email=${encodeURIComponent(email)}`), 800)
  }

  const handleSendPhoneOtp = async () => {
    setSendingPhoneOtp(true)
    setError("")
    setInfo("")
    setPhoneOtp("")

    if (!name.trim()) {
      setError("Full name is required")
      setSendingPhoneOtp(false)
      return
    }

    try {
      const auth = getFirebaseClientAuth()
      try {
        recaptchaRef.current?.clear()
      } catch {
        // ignore
      }
      recaptchaRef.current = null
      const el = document.getElementById("recaptcha-container-signup")
      if (el) el.innerHTML = ""

      const size = process.env.NODE_ENV === "production" ? "invisible" : "normal"
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container-signup", { size })

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
      const result = await loginWithPhoneIdToken(idToken, name.trim())
      if (result.ok) {
        router.push("/dashboard")
      } else {
        setError(result.error || "Phone signup failed")
      }
    } catch (err: any) {
      const message = err?.message || "OTP verification failed"
      setError(typeof message === "string" ? message : "OTP verification failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Create Account</CardTitle>
          <CardDescription className="text-center">Sign up to get discounted RC document downloads</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-5">
            <Button
              type="button"
              variant={method === "email" ? "default" : "outline"}
              className={method === "email" ? "flex-1" : "flex-1 bg-transparent"}
              onClick={() => {
                setMethod("email")
                setPhoneOtpSent(false)
                setError("")
                setInfo("")
              }}
            >
              Email
            </Button>
            <Button
              type="button"
              variant={method === "phone" ? "default" : "outline"}
              className={method === "phone" ? "flex-1" : "flex-1 bg-transparent"}
              onClick={() => {
                setMethod("phone")
                setPhoneOtpSent(false)
                setError("")
                setInfo("")
              }}
            >
              Phone OTP
            </Button>
          </div>

          <form onSubmit={method === "phone" ? handleVerifyPhoneOtp : handleSignup} className="space-y-4">
            {info && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-900">
                  {info}
                  {debugOtp ? <div className="mt-2 font-mono text-xs">OTP (dev): {debugOtp}</div> : null}
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {method === "email" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign up"}
            </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (E.164, e.g. +9198...)</Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    placeholder="+91XXXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                {!phoneOtpSent ? (
                  <Button type="button" className="w-full" onClick={handleSendPhoneOtp} disabled={!phone || sendingPhoneOtp}>
                    {sendingPhoneOtp ? "Sending OTP..." : "Send OTP"}
                  </Button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="phoneOtp">OTP</Label>
                      <Input
                        id="phoneOtp"
                        inputMode="numeric"
                        placeholder="6-digit code"
                        value={phoneOtp}
                        onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Verifying..." : "Verify & Create account"}
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
                      Use email instead
                    </Button>
                  </>
                )}

                <div
                  id="recaptcha-container-signup"
                  className={process.env.NODE_ENV === "production" ? "sr-only" : "flex justify-center"}
                />
              </>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Login
            </Link>
          </div>
          <div className="text-sm text-center text-muted-foreground">
            <Link href="/" className="text-primary hover:underline font-medium">
              Continue as guest
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

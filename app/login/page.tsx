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

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()

  const registered = useMemo(() => searchParams.get("registered") === "1", [searchParams])
  const reset = useMemo(() => searchParams.get("reset") === "1", [searchParams])

  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await login(identifier.trim(), password)
    if (result.ok) {
      router.push("/dashboard")
    } else {
      setError(result.error || "Login failed")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
          <CardDescription className="text-center">Use your email or mobile number with password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {registered && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-900">Account created. Please log in.</AlertDescription>
            </Alert>
          )}
          {reset && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-900">Password updated. Please log in.</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-base">
                Email or Mobile
              </Label>
              <Input
                id="identifier"
                placeholder="you@example.com or +91XXXXXXXXXX"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="h-11"
              />
            </div>
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
          </form>

          <div className="text-sm text-center text-muted-foreground">
            <Link href="/forgot-password" className="text-primary hover:underline font-medium">
              Forgot password?
            </Link>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3 pt-6">
          <div className="text-base text-center text-muted-foreground">
            Don&apos;t have an account?{" "}
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

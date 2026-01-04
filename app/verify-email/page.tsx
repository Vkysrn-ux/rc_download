"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function VerifyEmailPage() {
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => router.replace("/login"), 800)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>Email verification is no longer required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" onClick={() => router.push("/login")} variant="outline">
            Go to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

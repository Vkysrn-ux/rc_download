"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

function WhatsappSuccessContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id") || ""

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 p-4 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="text-6xl mb-3">✅</div>
          <CardTitle className="text-green-700">Payment Successful!</CardTitle>
          <CardDescription>
            Your document is being processed and will be sent to your WhatsApp shortly.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-3">
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              📱 Check your WhatsApp — you'll receive the document within a few seconds.
            </p>
          </div>
          {id && (
            <p className="text-xs text-gray-400">Reference: {id.slice(0, 8).toUpperCase()}</p>
          )}
          <p className="text-sm text-gray-500">
            If you don't receive it within 2 minutes, please contact support on WhatsApp.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function WhatsappSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Loading…</p></div>}>
      <WhatsappSuccessContent />
    </Suspense>
  )
}

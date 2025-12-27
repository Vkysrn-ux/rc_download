"use client"

import { useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, FileText, Search, DownloadIcon } from "lucide-react"
import Link from "next/link"

function DownloadPageContent() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [rcData, setRcData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const price = isAuthenticated ? 20 : 30

  const displayValue = (value: any) => {
    if (value === null || value === undefined) return "—"
    const text = String(value).trim()
    return text ? text : "—"
  }

  const handleSearch = async () => {
    setError("")
    setRcData(null)
    setLoading(true)

    const regNumber = registrationNumber.toUpperCase().replace(/\s/g, "")

    if (isAuthenticated && user && user.walletBalance < price) {
      setLoading(false)
      router.push(`/payment/confirm?registration=${encodeURIComponent(regNumber)}&source=upi`)
      return
    }

    const res = await fetch("/api/rc/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ registrationNumber: regNumber }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const providerNote = typeof json?.provider === "string" ? ` (source: ${json.provider})` : ""
      setError((json?.error || "Registration number not found") + providerNote)
    } else {
      setRcData(json.data)
    }

    setLoading(false)
  }

  const handleProceedToPayment = () => {
    if (isAuthenticated && user) {
      // Check if user has sufficient balance
      if (user.walletBalance >= price) {
        router.push(`/payment/confirm?registration=${registrationNumber}&source=wallet`)
      } else {
        router.push(`/payment/confirm?registration=${registrationNumber}&source=upi`)
      }
    } else {
      // Guest user - UPI payment
      router.push(`/payment/confirm?registration=${registrationNumber}&source=upi&guest=true`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push(isAuthenticated ? "/dashboard" : "/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Download RC</h1>
          </div>
          {!isAuthenticated && (
            <Link href="/login">
              <Button variant="outline" size="sm">
                Login for Discount
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enter Vehicle Registration Number</CardTitle>
              <CardDescription>
                Enter your vehicle registration number to fetch RC details
                {!isAuthenticated && " (Login to get ₹20 instead of ₹30)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="registration">Registration Number</Label>
                <div className="flex gap-2">
                  <Input
                    id="registration"
                    type="text"
                    placeholder="e.g., MH12AB1234"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={loading || !registrationNumber}>
                    {loading ? (
                      "Searching..."
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Try: MH12AB1234 or DL01CD5678</p>
              </div>
            </CardContent>
          </Card>

          {rcData && (
            <Card className="border-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle>RC Details Found</CardTitle>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Price</div>
                    <div className="text-2xl font-bold text-primary">₹{price}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Registration Number</div>
                    <div className="font-medium">{displayValue(rcData.registrationNumber)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Owner Name</div>
                    <div className="font-medium">{displayValue(rcData.ownerName)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Vehicle Class</div>
                    <div className="font-medium">{displayValue(rcData.vehicleClass)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Maker</div>
                    <div className="font-medium">{displayValue(rcData.maker)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Model</div>
                    <div className="font-medium">{displayValue(rcData.model)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Fuel Type</div>
                    <div className="font-medium">{displayValue(rcData.fuelType)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Registration Date</div>
                    <div className="font-medium">{displayValue(rcData.registrationDate)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Chassis Number</div>
                    <div className="font-medium">{displayValue(rcData.chassisNumber)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Engine Number</div>
                    <div className="font-medium">{displayValue(rcData.engineNumber)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Financier</div>
                    <div className="font-medium">{displayValue(rcData.financier)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Registration Authority</div>
                    <div className="font-medium">{displayValue(rcData.registrationAuthority)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Registration Validity</div>
                    <div className="font-medium">{displayValue(rcData.registrationValidity)}</div>
                  </div>
                  <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                    <div className="text-sm text-muted-foreground">Address</div>
                    <div className="font-medium">{displayValue(rcData.address)}</div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" size="lg" onClick={handleProceedToPayment}>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Proceed to Payment - ₹{price}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

export default function DownloadPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DownloadPageContent />
    </Suspense>
  )
}

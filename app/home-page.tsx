"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { FileText, Wallet, Shield, Zap, CheckCircle2, Clock, Lock } from "lucide-react"
import VirtualRcTemplate from "@/components/virtual-rc"
import { useRef } from "react"
import { RCDocumentPairPreview } from "@/components/rc-document-pair"
import Link from "next/link"

const ACCEPT_COOKIE_NAME = "rc_cookie_accepted"
const ACCEPT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function getCookieValue(name: string) {
  const cookies = typeof document === "undefined" ? "" : document.cookie
  return cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

export default function HomePageClient() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const [showCookieBanner, setShowCookieBanner] = useState(false)
  const [guestRegistration, setGuestRegistration] = useState("")
  const [guestResult, setGuestResult] = useState<string | null>(null)
  const [guestPhone, setGuestPhone] = useState("+91")
  const [showVahanPreview, setShowVahanPreview] = useState(false)
  const originalRootStyleRef = useRef<string>("")
  const originalBodyStyleRef = useRef<string>("")
  const originalGetPropertyValueRef = useRef<((prop: string) => string) | null>(null)

  useEffect(() => {
    // Monkeypatch CSSStyleDeclaration.getPropertyValue to avoid html2canvas parsing 'lab()' colors.
    if (typeof window !== "undefined" && CSSStyleDeclaration && !originalGetPropertyValueRef.current) {
      try {
        const proto = CSSStyleDeclaration.prototype as any
        originalGetPropertyValueRef.current = proto.getPropertyValue
        proto.getPropertyValue = function (prop: string) {
          try {
            const val = originalGetPropertyValueRef.current!.call(this, prop)
            if (typeof val === "string" && val.includes("lab(")) {
              return val.replace(/lab\([^)]*\)/g, "#111111")
            }
            return val
          } catch (e) {
            return originalGetPropertyValueRef.current!.call(this, prop)
          }
        }
      } catch (e) {
        // ignore
      }
    }
    if (!showVahanPreview) {
      // restore
      if (originalRootStyleRef.current) document.documentElement.setAttribute("style", originalRootStyleRef.current)
      if (originalBodyStyleRef.current) document.body.setAttribute("style", originalBodyStyleRef.current)
      // restore getPropertyValue
      if (originalGetPropertyValueRef.current) {
        try {
          ;(CSSStyleDeclaration.prototype as any).getPropertyValue = originalGetPropertyValueRef.current
          originalGetPropertyValueRef.current = null
        } catch {}
      }
      return
    }

    // save originals
    originalRootStyleRef.current = document.documentElement.getAttribute("style") || ""
    originalBodyStyleRef.current = document.body.getAttribute("style") || ""

    // Override common theme variables to simple hex values so any canvas/html2canvas parsing
    // won't encounter modern color functions like `lab()`.
    const root = document.documentElement
    const body = document.body
    root.style.setProperty("--background", "#ffffff")
    root.style.setProperty("--foreground", "#111111")
    root.style.setProperty("--card", "#ffffff")
    root.style.setProperty("--card-foreground", "#111111")
    root.style.setProperty("--popover", "#ffffff")
    root.style.setProperty("--popover-foreground", "#111111")
    root.style.setProperty("--primary", "#0b61d6")
    root.style.setProperty("--primary-foreground", "#ffffff")
    root.style.setProperty("--secondary", "#f3f4f6")
    root.style.setProperty("--secondary-foreground", "#111111")
    root.style.setProperty("--muted", "#f3f4f6")
    root.style.setProperty("--muted-foreground", "#6b7280")
    root.style.setProperty("--accent", "#f3f4f6")
    root.style.setProperty("--accent-foreground", "#111111")
    root.style.setProperty("--destructive", "#ef4444")
    root.style.setProperty("--destructive-foreground", "#ffffff")
    root.style.setProperty("--border", "#e5e7eb")
    root.style.setProperty("--input", "#e5e7eb")
    root.style.setProperty("--ring", "#93c5fd")
    body.style.backgroundColor = "#ffffff"
    body.style.color = "#000000"
  }, [showVahanPreview])

  const handlePay = async () => {
    const registration = (guestRegistration || "").trim()
    if (!registration) {
      setGuestResult("Enter vehicle registration to continue.")
      return
    }

    const digitsOnly = (guestPhone || "").replace(/\D/g, "")
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      setGuestResult("Please enter a valid phone number (with country code).")
      return
    }

    setGuestResult("Starting payment...")
    try {
      const res = await fetch("/api/cashfree/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purpose: "download",
          registrationNumber: registration,
          guest: true,
          customerPhone: guestPhone,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = json?.error || "Unable to start payment"
        setGuestResult(String(msg))
        return
      }

      const mode = json?.mode || "sandbox"
      const loader = await import("@/lib/cashfree-client")
      const cashfree = await loader.loadCashfree(mode)
      if (!cashfree) throw new Error("Cashfree failed to load")

      await cashfree.checkout({ paymentSessionId: json.paymentSessionId, redirectTarget: "_self" } as any)
    } catch (e: any) {
      setGuestResult(e?.message || "Payment failed")
    }
  }

  useEffect(() => {
    // If we returned from Cashfree, show a quick link to the success/download page inside the card.
    const params = new URLSearchParams(window.location.search)
    const transactionId = params.get("transactionId")
    const registration = params.get("registration")
    if (transactionId && registration) {
      setGuestResult(
        `PAY_SUCCESS::${registration}::${transactionId}`,
      )
    }
  }, [])

  useEffect(() => {
    setShowCookieBanner(!getCookieValue(ACCEPT_COOKIE_NAME))
  }, [])

  const acceptCookies = () => {
    document.cookie = `${ACCEPT_COOKIE_NAME}=1; path=/; max-age=${ACCEPT_COOKIE_MAX_AGE}; samesite=lax`
    setShowCookieBanner(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-blue-50/30 to-background">
      <header className="border-b bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center sm:justify-between">
          <div className="hidden sm:flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">VehicleRCDownload.com</div>
              <div className="text-xs text-muted-foreground">Docx Solutions</div>
            </div>
          </div>
          <div className="flex items-center gap-3 justify-center w-full sm:w-auto">
            {isAuthenticated ? (
              <Button onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => router.push("/login")}>
                  Login
                </Button>
                <Button onClick={() => router.push("/signup")}>Register</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-20 sm:pt-16 pb-16">
        <div className="max-w-6xl mx-auto space-y-16">
          <section className="grid md:grid-cols-2 gap-8">
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow mt-6 md:mt-0">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Zap className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Guest Access</CardTitle>
                      <CardDescription className="text-base mt-1">Quick one-time download</CardDescription>
                    </div>
                  </div>
                </div>
                    <div className="flex items-baseline gap-2 pt-2">
                      <span className="text-5xl font-bold text-foreground">₹22</span>
                      <span className="text-lg text-muted-foreground">per download</span>
                    </div>
              </CardHeader>
                  <CardContent>
                
                <div className="mt-4">
                  <Label htmlFor="guestRegistration" className="text-lg font-bold">Vehicle Registration</Label>
                  <Input
                    id="guestRegistration"
                    placeholder="MH12AB1234"
                    className="mt-2 text-lg font-bold"
                    value={guestRegistration}
                    onChange={(e) => setGuestRegistration(e.target.value.toUpperCase())}
                  />
                  <div className="mt-3">
                    <Label htmlFor="guestPhone">Whatsapp Number</Label>
                    <Input
                      id="guestPhone"
                      inputMode="tel"
                      placeholder="+9198xxxxxxxx"
                      className="mt-2"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                    />
                  </div>
                  <div className="mt-3 flex gap-3">
                    <Button onClick={handlePay} className="w-full">
                      Pay ₹22
                    </Button>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    {guestResult && guestResult.startsWith("PAY_SUCCESS::") ? (
                      (() => {
                        const [, registration, transactionId] = guestResult.split("::")
                        return (
                          <div>
                            Payment confirmed.{' '}
                            <a
                              href={`/payment/success?registration=${encodeURIComponent(registration)}&transactionId=${encodeURIComponent(transactionId)}`}
                              className="text-primary underline"
                            >
                              Open download
                            </a>
                          </div>
                        )
                      })()
                    ) : (
                      guestResult
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-2 border-primary hover:shadow-xl transition-shadow">
              <div className="absolute top-0 right-0 px-4 py-1 bg-accent text-accent-foreground text-xs font-bold rounded-bl-lg">
                SAVE 33%
              </div>
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <Wallet className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Registered User</CardTitle>
                      <CardDescription className="text-base mt-1">Best value with wallet</CardDescription>
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline gap-3 pt-2">
                  <span className="text-5xl font-bold text-primary">₹18</span>
                  <span className="text-lg text-muted-foreground line-through">₹22</span>
                  <span className="text-lg text-muted-foreground">per download</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-base">Discounted pricing (33% off)</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-base">Wallet balance convenience</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-base">Minimum recharge of ₹50 and get 4 RC downloads for first-time users</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-base">Wallet transactions and more services available</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-base">Complete download history</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-base">Transaction tracking</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </section>

          <section className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-blue-700">
              <Shield className="h-4 w-4" />
              Official Documents, One Platform
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-balance leading-tight">
              Download Vehicle RC
              <br />
              <span className="text-primary">Documents Instantly</span>
            </h1>
            <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto leading-relaxed">
              Fast, secure, and reliable access to your Registration Certificate documents with instant digital delivery
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
              <Button
                size="lg"
                className="text-base px-8"
                onClick={() => router.push(isAuthenticated ? "/dashboard" : "/download")}
              >
                Download RC Now
              </Button>
              {!isAuthenticated && (
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base px-8 bg-transparent"
                  onClick={() => router.push("/signup")}
                >
                  Register for Discount
                </Button>
              )}
            </div>

            <div className="flex justify-center gap-4 pt-6">
              
            </div>
          </section>

          <section className="grid md:grid-cols-3 gap-8 pt-8">
            <Card className="text-center hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="mx-auto p-4 bg-blue-50 rounded-full w-fit">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl pt-4">Instant Delivery</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Get your RC document delivered instantly as a downloadable PDF within seconds of payment
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="mx-auto p-4 bg-green-50 rounded-full w-fit">
                  <Lock className="h-8 w-8 text-accent" />
                </div>
                <CardTitle className="text-xl pt-4">Secure & Safe</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  All transactions are secured with industry-standard encryption and processed via a secure payment gateway
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="mx-auto p-4 bg-purple-50 rounded-full w-fit">
                  <FileText className="h-8 w-8 text-purple-600" />
                </div>
                <CardTitle className="text-xl pt-4">Official Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Download convenient PDF copies of your documents with secure delivery and fast processing
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      {showVahanPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowVahanPreview(false)} />
          <div className="relative max-w-lg w-full mx-4">
            <div className="bg-white rounded-lg shadow-lg overflow-auto">
              <div className="p-3 flex items-center justify-between border-b">
                <div className="text-lg font-semibold">Vahan Preview</div>
                <Button variant="ghost" onClick={() => setShowVahanPreview(false)}>Close</Button>
              </div>
              <div className="p-4">
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  <div className="rounded-md border p-2 bg-white">
                    <RCDocumentPairPreview
                      data={{
                        registrationNumber: guestRegistration || "MH12AB1234",
                        ownerName: "Vignesh S",
                        vehicleClass: "M-CYCLE/SCOOTER",
                        maker: "Bajaj",
                        model: "Avenger 220",
                        fuelType: "Petrol",
                        registrationDate: "2016-06-03",
                        chassisNumber: "MD2A2EZ6GCBS6017",
                        engineNumber: "PDZCB19946",
                        address: "",
                      }}
                      frontId="home-rc-front"
                      backId="home-rc-back"
                     />
                  </div>

                  <div className="rounded-md border p-2 bg-white">
                    <div className="text-sm font-medium mb-2">Vahan Virtual RC (Preview)</div>
                    <VirtualRcTemplate
                      data={{
                        registrationNumber: guestRegistration || "TN38CE0078",
                        ownerName: "Vignesh S",
                        vehicleClass: "M-CYCLE/SCOOTER",
                        maker: "Bajaj",
                        model: "Avenger 220 Street Bs Iii",
                        fuelType: "Petrol",
                        registrationDate: "2016-06-03",
                        chassisNumber: "MD2A2EZ6GCBS6017",
                        engineNumber: "PDZCB19946",
                        address: "—",
                      }}
                      id="home-rc-virtual"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t bg-muted/30 mt-24">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-foreground mb-4">About</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Docx Solutions operates VehicleRCDownload.com, a one-stop site for Vehicle RC downloads and other
                official documents.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/download" className="text-muted-foreground hover:text-primary transition-colors">
                    Download RC
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/transactions" className="text-muted-foreground hover:text-primary transition-colors">
                    Transactions
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                    Terms & Conditions
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4">Support</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/helpdesk" className="text-muted-foreground hover:text-primary transition-colors">
                    Help Center
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:support@vehiclercdownload.com"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    support@vehiclercdownload.com
                  </a>
                </li>
                <li>
                  <a href="tel:+919677979393" className="text-muted-foreground hover:text-primary transition-colors">
                    9677979393
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-6 text-center text-sm text-muted-foreground">
            <p>© 2025 Docx Solutions. All rights reserved.</p>
            <p className="mt-2">VehicleRCDownload.com</p>
          </div>
        </div>
      </footer>

      {showCookieBanner && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use cookies to keep you signed in and improve the experience. By using this site you agree to our{" "}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={acceptCookies}>
                Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCookieBanner(false)}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



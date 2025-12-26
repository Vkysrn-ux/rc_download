"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { FileText, Wallet, Shield, Zap, CheckCircle2, Clock, Lock } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-blue-50/30 to-background">
      <header className="border-b bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">RC Download Portal</div>
              <div className="text-xs text-muted-foreground">Ministry of Road Transport</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/test-credentials")}>
              Setup
            </Button>
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

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto space-y-16">
          <section className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-blue-700">
              <Shield className="h-4 w-4" />
              Official Government Service
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
          </section>

          <section className="grid md:grid-cols-2 gap-8">
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
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
                  <span className="text-5xl font-bold text-foreground">₹30</span>
                  <span className="text-lg text-muted-foreground">per download</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-base">No registration required</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-base">Secure Razorpay payment</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-base">Instant PDF download</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-base">Valid RC certificate</span>
                  </li>
                </ul>
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
                  <span className="text-5xl font-bold text-primary">₹20</span>
                  <span className="text-lg text-muted-foreground line-through">₹30</span>
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
                  All transactions are secured with industry-standard encryption and processed via Razorpay
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
                  All documents are authentic and sourced directly from the official government database
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <footer className="border-t bg-muted/30 mt-24">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-foreground mb-4">About</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Official portal for downloading Vehicle Registration Certificate documents under the Ministry of Road
                Transport and Highways.
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
                    href="mailto:support@rcportal.gov.in"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    support@rcportal.gov.in
                  </a>
                </li>
                <li>
                  <a href="tel:1800-267-0267" className="text-muted-foreground hover:text-primary transition-colors">
                    1800-267-0267 (Toll-Free)
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-6 text-center text-sm text-muted-foreground">
            <p>© 2025 RC Download Portal. All rights reserved.</p>
            <p className="mt-2">Ministry of Road Transport and Highways, Government of India</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

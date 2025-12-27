"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, FileText, LogOut, Plus, Download, History } from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login")
      return
    }

    if (user?.role === "admin") {
      router.replace("/admin/dashboard")
    }
  }, [isAuthenticated, user?.role, router])

  if (!isAuthenticated || !user) {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  if (user.role === "admin") return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-background">
      <header className="border-b bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <div className="p-2 bg-primary rounded-lg">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">VehicleRCDownload.com</div>
              <div className="text-xs text-muted-foreground">Docx Solutions</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm hidden sm:block">
              <span className="text-muted-foreground">Welcome, </span>
              <span className="font-semibold">{user.name}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
            <p className="text-lg text-muted-foreground">Manage your wallet and download RC documents</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-primary/20 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-green-100 to-green-50 rounded-xl">
                      <Wallet className="h-6 w-6 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl">Wallet Balance</CardTitle>
                  </div>
                  <Button onClick={() => router.push("/wallet/recharge")} size="lg">
                    <Plus className="h-5 w-5 mr-2" />
                    Add Money
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-baseline gap-3">
                    <span className="text-6xl font-bold text-primary">₹{user.walletBalance.toFixed(2)}</span>
                    <span className="text-xl text-muted-foreground">available</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                    <span className="text-base text-blue-900">
                      RC downloads at <span className="font-bold">₹20 each</span> for registered users
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Downloads available:{" "}
                    <span className="font-bold text-foreground text-base">{Math.floor(user.walletBalance / 20)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-xl">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full justify-start h-12 text-base"
                  size="lg"
                  onClick={() => router.push("/download")}
                >
                  <Download className="h-5 w-5 mr-3" />
                  Download RC
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 text-base bg-transparent"
                  size="lg"
                  onClick={() => router.push("/transactions")}
                >
                  <History className="h-5 w-5 mr-3" />
                  View History
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl">How to Use</CardTitle>
              <CardDescription className="text-base">
                Follow these simple steps to download your RC documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg">
                    1
                  </div>
                  <h3 className="font-bold text-lg">Add Money to Wallet</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Recharge your wallet using Razorpay for secure and convenient transactions
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg">
                    2
                  </div>
                  <h3 className="font-bold text-lg">Enter Vehicle Details</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Provide your vehicle registration number to fetch RC details from the database
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg">
                    3
                  </div>
                  <h3 className="font-bold text-lg">Download Instantly</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Get your RC document as a PDF immediately after successful payment
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

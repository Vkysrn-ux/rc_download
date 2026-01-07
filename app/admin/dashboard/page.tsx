"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, LogOut, Users, DollarSign, Activity, TrendingUp, Download, CreditCard, Cloud, RefreshCcw, BarChart3 } from "lucide-react"

interface Transaction {
  id: string
  type: "recharge" | "download"
  amount: number
  status: string
  timestamp: string
  description: string
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalRevenue: 0,
    totalDownloads: 0,
    surepassHits: 0,
    cacheReused: 0,
  })

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    if (user?.role !== "admin") {
      router.push("/dashboard")
      return
    }

    loadAdminData()
  }, [isAuthenticated, user, router])

  const loadAdminData = async () => {
    setLoading(true)
    setError("")
    const res = await fetch("/api/admin/summary")
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || "Failed to load dashboard data")
      setLoading(false)
      return
    }

    setStats(json?.stats || { totalUsers: 0, activeUsers: 0, totalRevenue: 0, totalDownloads: 0 })
    setRecentTransactions(json?.recentTransactions || [])
    setLoading(false)
  }

  const handleLogout = () => {
    void logout().catch(() => {})
    router.push("/")
  }

  if (!isAuthenticated || !user || user.role !== "admin") {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-background">
      <header className="border-b bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">Admin Dashboard</div>
              <div className="text-xs text-muted-foreground">VehicleRCDownload.com Management</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm hidden sm:block">
              <span className="text-muted-foreground">Welcome, </span>
              <span className="font-semibold">{user.name}</span>
              <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                Admin
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-lg text-muted-foreground">Monitor system activity and manage users</p>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          {/* Stats Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">Registered accounts</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.activeUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">With wallet balance</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">₹{stats.totalRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">From wallet recharges</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Downloads</CardTitle>
                  <Download className="h-5 w-5 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalDownloads}</div>
                <p className="text-xs text-muted-foreground mt-1">RC documents</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Surepass Hits</CardTitle>
                  <Cloud className="h-5 w-5 text-sky-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.surepassHits}</div>
                <p className="text-xs text-muted-foreground mt-1">External RC lookups</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Cache Reused</CardTitle>
                  <RefreshCcw className="h-5 w-5 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.cacheReused}</div>
                <p className="text-xs text-muted-foreground mt-1">Served from DB cache</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start h-12 text-base" onClick={() => router.push("/admin/users")}>
                  <Users className="h-5 w-5 mr-3" />
                  Manage Users
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 text-base bg-transparent"
                  onClick={() => router.push("/admin/api-usage")}
                >
                  <BarChart3 className="h-5 w-5 mr-3" />
                  API Usage
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 text-base bg-transparent"
                  onClick={() => router.push("/admin/payments?gateway=cashfree")}
                >
                  <CreditCard className="h-5 w-5 mr-3" />
                  Cashfree Transactions
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 text-base bg-transparent"
                  onClick={() => router.push("/admin/payments")}
                >
                  <CreditCard className="h-5 w-5 mr-3" />
                  View All Payments
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 text-base bg-transparent"
                  onClick={() => router.push("/admin/credit-wallet")}
                >
                  <TrendingUp className="h-5 w-5 mr-3" />
                  Credit User Wallet
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loading && recentTransactions.length === 0 && (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  )}
                  {recentTransactions
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 5)
                    .map((txn) => {
                      const parts = txn.description.split(" - ")
                      const mainDesc = parts.slice(0, 2).join(" - ")
                      const phonePart = parts.length >= 3 ? parts.slice(2).join(" - ") : ""
                      const isCompleted = txn.status === "completed"
                      const isFailed = txn.status === "failed"
                      const badgeClasses = isCompleted
                        ? "bg-emerald-50 text-emerald-700 border-transparent"
                        : isFailed
                        ? "bg-red-50 text-destructive border-transparent"
                        : ""

                      return (
                        <div key={txn.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{mainDesc}</p>
                            {phonePart ? (
                              <p className="text-xs text-muted-foreground">{phonePart}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">{new Date(txn.timestamp).toLocaleDateString()}</p>
                            )}
                          </div>
                          <Badge className={badgeClasses}>
                            {txn.type === "recharge" ? "+" : ""}₹{Math.abs(txn.amount)}
                          </Badge>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

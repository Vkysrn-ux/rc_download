"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, LogOut, Users, DollarSign, Activity, TrendingUp, Download, CreditCard } from "lucide-react"

interface User {
  id: string
  email: string
  name: string
  walletBalance: number
  role: string
}

interface Transaction {
  id: string
  userId: string
  type: string
  amount: number
  status: string
  timestamp: string
  description: string
  paymentMethod?: string
  registrationNumber?: string
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalRevenue: 0,
    totalDownloads: 0,
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

  const loadAdminData = () => {
    const users = JSON.parse(localStorage.getItem("rc_app_users") || "[]")
    const transactions = JSON.parse(localStorage.getItem("rc_app_transactions") || "[]")

    setAllUsers(users)
    setAllTransactions(transactions)

    // Calculate stats
    const activeUsers = users.filter((u: User) => u.walletBalance > 0).length
    const totalRevenue = transactions
      .filter((t: Transaction) => t.type === "recharge" && t.status === "completed")
      .reduce((sum: number, t: Transaction) => sum + t.amount, 0)
    const totalDownloads = transactions.filter((t: Transaction) => t.type === "download").length

    setStats({
      totalUsers: users.length,
      activeUsers,
      totalRevenue,
      totalDownloads,
    })
  }

  const handleLogout = () => {
    logout()
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
              <div className="text-xs text-muted-foreground">RC Download Portal Management</div>
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
                  {allTransactions
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 5)
                    .map((txn) => (
                      <div key={txn.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{txn.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(txn.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={txn.type === "recharge" ? "default" : "secondary"}>
                          {txn.type === "recharge" ? "+" : ""}₹{Math.abs(txn.amount)}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

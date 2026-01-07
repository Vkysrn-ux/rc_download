"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, LogOut, ArrowLeft, Download, CreditCard, RefreshCw } from "lucide-react"

interface Transaction {
  id: string
  userId?: string | null
  userName?: string | null
  userEmail?: string | null
  type: "recharge" | "download"
  amount: number
  status: string
  timestamp: string
  description: string
  paymentMethod?: string | null
  registrationNumber?: string | null
  customerPhone?: string | null
}

export default function AdminPaymentsPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "failed">("all")

  function extractPhone(desc?: string) {
    if (!desc) return ""
    const m = desc.match(/\+?\d{10,15}/g)
    return m ? m[0] : ""
  }

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      router.push("/login")
      return
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, router])

  const loadData = async () => {
    setLoading(true)
    setError("")
    const gateway = searchParams?.get("gateway") || ""
    const apiPath = gateway && gateway.toLowerCase() === "cashfree" ? "/api/admin/transactions/cashfree" : "/api/admin/transactions"
    const res = await fetch(apiPath)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || "Failed to load transactions")
      setLoading(false)
      return
    }
    const all = json.transactions || []
    setTransactions(all)
    setLoading(false)
  }

  const approve = async (transactionId: string) => {
    setApprovingId(transactionId)
    const res = await fetch("/api/admin/transactions/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transactionId }),
    })
    setApprovingId(null)
    if (!res.ok) return
    await loadData()
  }

  const totalRevenue = useMemo(() => {
    return transactions
      .filter((t) => t.type === "recharge" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0)
  }, [transactions])

  if (!isAuthenticated || !user || user.role !== "admin") return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-background">
      <header className="border-b bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="p-2 bg-primary rounded-lg">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">Payment History</div>
              <div className="text-xs text-muted-foreground">All transactions and payments</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="bg-transparent">
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">₹{totalRevenue.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{transactions.length}</div>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{transactions.filter((t) => t.status === "pending").length}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl">All Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2">
                <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>All</Button>
                <Button size="sm" variant={statusFilter === "completed" ? "default" : "outline"} onClick={() => setStatusFilter("completed")}>Successful</Button>
                <Button size="sm" variant={statusFilter === "failed" ? "destructive" : "outline"} onClick={() => setStatusFilter("failed")}>Failed</Button>
                <div className="ml-auto text-sm text-muted-foreground">Showing {transactions.length} transactions</div>
              </div>

              <div className="space-y-3">
                {transactions
                  .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
                  .map((txn) => (
                    <Card key={txn.id} className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-3 flex-1">
                            <div className={`p-3 rounded-lg ${txn.type === "recharge" ? "bg-green-100" : "bg-blue-100"}`}>
                              {txn.type === "recharge" ? (
                                <CreditCard className="h-5 w-5 text-green-600" />
                              ) : (
                                <Download className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold">{txn.description}</h3>
                                <Badge variant={txn.type === "recharge" ? "default" : "secondary"}>{txn.type}</Badge>
                                <Badge
                                  variant={txn.status === "completed" ? "default" : txn.status === "failed" ? "destructive" : "outline"}
                                >
                                  {txn.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {txn.userName
                                  ? `${txn.userName} (${txn.userEmail ?? ""})`
                                  : (txn as any).customerPhone || extractPhone(txn.description) || txn.userEmail || "Guest"}
                              </p>
                              {txn.registrationNumber && (
                                <p className="text-sm font-mono bg-muted px-2 py-1 rounded inline-block">
                                  {txn.registrationNumber}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{new Date(txn.timestamp).toLocaleString()}</span>
                                {txn.paymentMethod && <span>Payment: {txn.paymentMethod}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right space-y-2">
                            <div className={`text-2xl font-bold ${txn.status === "completed" ? "text-emerald-600" : txn.status === "failed" ? "text-destructive" : txn.type === "recharge" ? "text-green-600" : "text-blue-600"}`}>
                              {txn.type === "recharge" ? "+" : ""}₹{Math.abs(txn.amount)}
                            </div>
                            {txn.status === "pending" && txn.type === "recharge" && (
                              <Button
                                size="sm"
                                onClick={() => approve(txn.id)}
                                disabled={approvingId === txn.id}
                              >
                                {approvingId === txn.id ? "Approving..." : "Approve"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}


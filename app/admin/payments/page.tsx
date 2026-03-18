"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, LogOut, ArrowLeft, Download, CreditCard, RefreshCw, CalendarDays, X } from "lucide-react"

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
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [monthFilter, setMonthFilter] = useState("all")

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

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Status filter
      if (statusFilter !== "all" && t.status !== statusFilter) return false

      const txDate = new Date(t.timestamp)

      // Month filter (format: "2026-03")
      if (monthFilter !== "all") {
        const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`
        if (txMonth !== monthFilter) return false
      }

      // Date range filter
      if (dateFrom) {
        const from = new Date(dateFrom)
        from.setHours(0, 0, 0, 0)
        if (txDate < from) return false
      }
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        if (txDate > to) return false
      }

      return true
    })
  }, [transactions, statusFilter, monthFilter, dateFrom, dateTo])

  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    transactions.forEach((t) => {
      const d = new Date(t.timestamp)
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    })
    return Array.from(months).sort().reverse()
  }, [transactions])

  const totalRevenue = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.status === "completed")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  }, [filteredTransactions])

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
                <div className="text-3xl font-bold">{filteredTransactions.length}</div>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{filteredTransactions.filter((t) => t.status === "pending").length}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl">All Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Status filter */}
              <div className="mb-4 flex flex-wrap gap-2">
                <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>All</Button>
                <Button size="sm" variant={statusFilter === "completed" ? "default" : "outline"} onClick={() => setStatusFilter("completed")}>Successful</Button>
                <Button size="sm" variant={statusFilter === "failed" ? "destructive" : "outline"} onClick={() => setStatusFilter("failed")}>Failed</Button>
                <div className="ml-auto text-sm text-muted-foreground">Showing {filteredTransactions.length} of {transactions.length} transactions</div>
              </div>

              {/* Date & month filters */}
              <div className="mb-4 flex flex-wrap items-end gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Filters:</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Month</label>
                  <Select value={monthFilter} onValueChange={(v) => { setMonthFilter(v); if (v !== "all") { setDateFrom(""); setDateTo("") } }}>
                    <SelectTrigger className="w-[160px] h-8 text-sm bg-white">
                      <SelectValue placeholder="All months" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All months</SelectItem>
                      {availableMonths.map((m) => {
                        const [y, mo] = m.split("-")
                        const label = new Date(Number(y), Number(mo) - 1).toLocaleString("default", { month: "long", year: "numeric" })
                        return <SelectItem key={m} value={m}>{label}</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">From</label>
                  <Input type="date" className="w-[150px] h-8 text-sm bg-white" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); if (e.target.value) setMonthFilter("all") }} />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">To</label>
                  <Input type="date" className="w-[150px] h-8 text-sm bg-white" value={dateTo} onChange={(e) => { setDateTo(e.target.value); if (e.target.value) setMonthFilter("all") }} />
                </div>

                {(dateFrom || dateTo || monthFilter !== "all") && (
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => { setDateFrom(""); setDateTo(""); setMonthFilter("all") }}>
                    <X className="h-3.5 w-3.5 mr-1" /> Clear
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {filteredTransactions.map((txn) => (
                    <Card key={txn.id} className={`shadow-sm border-l-4 ${txn.status === "completed" ? "border-l-green-500" : txn.status === "failed" ? "border-l-red-500" : "border-l-yellow-500"}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-3 flex-1">
                            <div className={`p-3 rounded-lg ${txn.status === "completed" ? "bg-green-100" : txn.status === "failed" ? "bg-red-100" : "bg-yellow-100"}`}>
                              {txn.type === "recharge" ? (
                                <CreditCard className={`h-5 w-5 ${txn.status === "completed" ? "text-green-600" : txn.status === "failed" ? "text-red-600" : "text-yellow-600"}`} />
                              ) : (
                                <Download className={`h-5 w-5 ${txn.status === "completed" ? "text-green-600" : txn.status === "failed" ? "text-red-600" : "text-yellow-600"}`} />
                              )}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold">{txn.description}</h3>
                                <Badge variant={txn.type === "recharge" ? "default" : "secondary"}>{txn.type}</Badge>
                                <Badge
                                  className={txn.status === "completed" ? "bg-green-500 hover:bg-green-600 text-white" : txn.status === "failed" ? "bg-red-500 hover:bg-red-600 text-white" : "bg-yellow-500 hover:bg-yellow-600 text-white"}
                                >
                                  {txn.status === "completed" ? "Success" : txn.status === "failed" ? "Failed" : "Pending"}
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
                            <div className={`text-2xl font-bold ${txn.status === "completed" ? "text-green-600" : txn.status === "failed" ? "text-red-600" : "text-yellow-600"}`}>
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


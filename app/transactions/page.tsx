"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, RefreshCw } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { formatInr } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Transaction {
  id: string
  type: "recharge" | "download"
  amount: number
  status: string
  timestamp: string
  description: string
  registrationNumber?: string | null
  paymentMethod?: string | null
}

export default function TransactionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, refreshUser } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const filterType = (searchParams.get("type") || "").toLowerCase()
  const activeFilter: "all" | "download" | "recharge" =
    filterType === "download" ? "download" : filterType === "recharge" ? "recharge" : "all"

  const loadTransactions = async () => {
    setLoading(true)
    setError("")
    const res = await fetch("/api/transactions/my")
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || "Failed to load transactions")
      setLoading(false)
      return
    }
    setTransactions(json.transactions || [])
    setLoading(false)
    await refreshUser()
  }

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    loadTransactions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, router])

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const filtered = useMemo(() => {
    if (activeFilter === "all") return transactions
    return transactions.filter((t) => t.type === activeFilter)
  }, [activeFilter, transactions])

  const title = activeFilter === "download" ? "Downloaded History" : activeFilter === "recharge" ? "Wallet Transactions" : "Your Transactions"
  const description =
    activeFilter === "download"
      ? "View your RC download history"
      : activeFilter === "recharge"
        ? "View your wallet recharge history"
        : "View all your wallet recharges and RC downloads"

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Transaction History</h1>
          </div>
          <Button variant="outline" size="sm" onClick={loadTransactions} disabled={loading} className="bg-transparent">
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  variant={activeFilter === "all" ? "default" : "outline"}
                  size="sm"
                  className={activeFilter === "all" ? "" : "bg-transparent"}
                  onClick={() => router.replace("/transactions")}
                >
                  All
                </Button>
                <Button
                  variant={activeFilter === "download" ? "default" : "outline"}
                  size="sm"
                  className={activeFilter === "download" ? "" : "bg-transparent"}
                  onClick={() => router.replace("/transactions?type=download")}
                >
                  Downloads
                </Button>
                <Button
                  variant={activeFilter === "recharge" ? "default" : "outline"}
                  size="sm"
                  className={activeFilter === "recharge" ? "" : "bg-transparent"}
                  onClick={() => router.replace("/transactions?type=recharge")}
                >
                  Wallet
                </Button>
              </div>

              {error && <div className="text-sm text-destructive mb-3">{error}</div>}

              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No transactions yet</p>
                  <Button className="mt-4" onClick={() => router.push("/download")}>
                    Download Your First RC
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${transaction.type === "recharge" ? "bg-green-100" : "bg-blue-100"}`}>
                          {transaction.type === "recharge" ? (
                            <ArrowUpCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <ArrowDownCircle className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="text-sm text-muted-foreground">{formatDate(transaction.timestamp)}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {transaction.paymentMethod && (
                              <Badge variant="outline" className="text-xs">
                                via {transaction.paymentMethod}
                              </Badge>
                            )}
                            <Badge variant={transaction.status === "completed" ? "default" : "secondary"} className="text-xs">
                              {transaction.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${transaction.type === "recharge" ? "text-green-600" : "text-blue-600"}`}>
                          {transaction.type === "recharge" ? "+" : "-"}
                          {formatInr(Math.abs(transaction.amount), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        {transaction.registrationNumber && <div className="text-xs text-muted-foreground">{transaction.registrationNumber}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

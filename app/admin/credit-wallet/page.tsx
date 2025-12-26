"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, LogOut, ArrowLeft, Wallet, CheckCircle } from "lucide-react"

function CreditWalletContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, logout } = useAuth()
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      router.push("/login")
      return
    }

    const users = JSON.parse(localStorage.getItem("rc_app_users") || "[]")
    setAllUsers(users)

    const preselectedUserId = searchParams.get("userId")
    if (preselectedUserId) {
      setSelectedUserId(preselectedUserId)
    }
  }, [isAuthenticated, user, router, searchParams])

  const handleCredit = () => {
    if (!selectedUserId || !amount || Number.parseFloat(amount) <= 0) {
      alert("Please select a user and enter a valid amount")
      return
    }

    const users = JSON.parse(localStorage.getItem("rc_app_users") || "[]")
    const userIndex = users.findIndex((u: any) => u.id === selectedUserId)

    if (userIndex === -1) {
      alert("User not found")
      return
    }

    users[userIndex].walletBalance += Number.parseFloat(amount)
    localStorage.setItem("rc_app_users", JSON.stringify(users))

    const transactions = JSON.parse(localStorage.getItem("rc_app_transactions") || "[]")
    const newTransaction = {
      id: `txn${Date.now()}`,
      userId: selectedUserId,
      type: "recharge",
      amount: Number.parseFloat(amount),
      status: "completed",
      timestamp: new Date().toISOString(),
      description: `Admin Credit: ${reason || "Manual wallet credit"}`,
      paymentMethod: "Admin",
    }
    transactions.push(newTransaction)
    localStorage.setItem("rc_app_transactions", JSON.stringify(transactions))

    setSuccess(true)
    setTimeout(() => {
      router.push("/admin/users")
    }, 2000)
  }

  if (!isAuthenticated || !user || user.role !== "admin") {
    return null
  }

  const selectedUser = allUsers.find((u) => u.id === selectedUserId)

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
              <div className="text-lg font-bold text-foreground">Credit User Wallet</div>
              <div className="text-xs text-muted-foreground">Add money to user accounts</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {success ? (
            <Card className="shadow-lg border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
                  <h2 className="text-2xl font-bold text-green-900">Wallet Credited Successfully!</h2>
                  <p className="text-green-700">Redirecting to user management...</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Wallet className="h-6 w-6" />
                  Credit User Wallet
                </CardTitle>
                <CardDescription>Add funds to a user's wallet balance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="user">Select User</Label>
                  <select
                    id="user"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full h-12 px-4 border rounded-lg text-base"
                  >
                    <option value="">-- Select a user --</option>
                    {allUsers
                      .filter((u) => u.role !== "admin")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email}) - Current Balance: ₹{u.walletBalance.toFixed(2)}
                        </option>
                      ))}
                  </select>
                </div>

                {selectedUser && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Selected User:</p>
                        <p className="font-bold text-lg">{selectedUser.name}</p>
                        <p className="text-sm">{selectedUser.email}</p>
                        <p className="text-lg font-semibold text-primary">
                          Current Balance: ₹{selectedUser.walletBalance.toFixed(2)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount to Credit (₹)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-12 text-base"
                    min="1"
                    step="0.01"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Input
                    id="reason"
                    type="text"
                    placeholder="e.g., Promotional credit, Refund, etc."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>

                {selectedUser && amount && Number.parseFloat(amount) > 0 && (
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground mb-1">New Balance Preview:</p>
                      <p className="text-2xl font-bold text-green-700">
                        ₹{(selectedUser.walletBalance + Number.parseFloat(amount)).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Button onClick={handleCredit} size="lg" className="w-full h-12 text-base">
                  <Wallet className="h-5 w-5 mr-2" />
                  Credit Wallet
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

export default function CreditWalletPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreditWalletContent />
    </Suspense>
  )
}

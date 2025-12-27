"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { FileText, LogOut, Search, Wallet, UserCheck, UserX, ArrowLeft, Download, DollarSign, X } from "lucide-react"

interface User {
  id: string
  email: string
  name: string
  walletBalance: number
  role: string
  isActive: boolean
}

interface Transaction {
  id: string
  userId: string | null
  type: "recharge" | "download"
  amount: number
  timestamp: string
  description: string
  status?: string
  registrationNumber?: string | null
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<"downloads" | "transactions">("downloads")
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      router.push("/login")
      return
    }

    void loadUsers()
  }, [isAuthenticated, user, router])

  useEffect(() => {
    if (searchQuery) {
      const filtered = allUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      setFilteredUsers(filtered)
    } else {
      setFilteredUsers(allUsers)
    }
  }, [searchQuery, allUsers])

  const loadUsers = async () => {
    setLoadingUsers(true)
    setError("")
    const res = await fetch("/api/admin/users")
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || "Failed to load users")
      setLoadingUsers(false)
      return
    }
    const users = (json?.users || []) as User[]
    setAllUsers(users)
    setSelectedUser((prev) => (prev ? users.find((u) => u.id === prev.id) ?? prev : prev))
    setLoadingUsers(false)
  }

  const loadUserTransactions = async (userId: string) => {
    setLoadingTransactions(true)
    setError("")
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/transactions`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || "Failed to load transactions")
      setLoadingTransactions(false)
      return
    }
    setUserTransactions((json?.transactions || []) as Transaction[])
    setLoadingTransactions(false)
  }

  const handleUserClick = (u: User) => {
    setSelectedUser(u)
    setActiveTab("downloads")
    void loadUserTransactions(u.id)
  }

  const toggleUserStatus = async (userId: string) => {
    const current = allUsers.find((u) => u.id === userId) ?? selectedUser
    const nextIsActive = !(current?.isActive ?? true)

    setError("")
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: nextIsActive }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || "Failed to update user status")
      return
    }

    await loadUsers()
    if (selectedUser?.id === userId) {
      setSelectedUser({ ...selectedUser, isActive: nextIsActive })
    }
  }

  const navigateToCredit = (userId: string) => {
    router.push(`/admin/credit-wallet?userId=${userId}`)
  }

  const getDownloads = () => {
    return userTransactions.filter((t) => t.type === "download")
  }

  if (!isAuthenticated || !user || user.role !== "admin") {
    return null
  }

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
              <div className="text-lg font-bold text-foreground">User Management</div>
              <div className="text-xs text-muted-foreground">Manage user accounts and status</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {error && <div className="text-sm text-destructive">{error}</div>}
          {selectedUser ? (
            <div className="space-y-6">
              <Card className="shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                      <div>
                        <CardTitle className="text-2xl">{selectedUser.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{selectedUser.email}</p>
                      </div>
                      {selectedUser.role === "admin" && (
                        <Badge variant="default" className="text-xs">
                          Admin
                        </Badge>
                      )}
                      <Badge variant={selectedUser.isActive !== false ? "default" : "secondary"} className="text-xs">
                        {selectedUser.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Wallet Balance</p>
                        <p className="text-2xl font-bold text-green-600">₹{selectedUser.walletBalance.toFixed(2)}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigateToCredit(selectedUser.id)}>
                        Add Money
                      </Button>
                      {selectedUser.role !== "admin" && (
                        <Button
                          variant={selectedUser.isActive !== false ? "destructive" : "default"}
                          size="sm"
                          onClick={() => toggleUserStatus(selectedUser.id)}
                        >
                          {selectedUser.isActive !== false ? (
                            <>
                              <UserX className="h-4 w-4 mr-1" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 mr-1" />
                              Activate
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <Card className="shadow-md">
                <CardHeader>
                  <div className="flex gap-2 border-b">
                    <Button
                      variant={activeTab === "downloads" ? "default" : "ghost"}
                      onClick={() => setActiveTab("downloads")}
                      className="rounded-b-none"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      RC Downloads ({getDownloads().length})
                    </Button>
                    <Button
                      variant={activeTab === "transactions" ? "default" : "ghost"}
                      onClick={() => setActiveTab("transactions")}
                      className="rounded-b-none"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      All Transactions ({userTransactions.length})
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingTransactions && <div className="text-sm text-muted-foreground py-3">Loading…</div>}
                  {activeTab === "downloads" ? (
                    <div className="space-y-3">
                      {getDownloads().length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No downloads yet</div>
                      ) : (
                        getDownloads().map((txn) => (
                          <Card key={txn.id} className="shadow-sm">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-100 rounded-lg">
                                    <Download className="h-5 w-5 text-blue-600" />
                                  </div>
                                   <div>
                                     <p className="font-semibold">{txn.registrationNumber}</p>
                                     <p className="text-sm text-muted-foreground">{txn.description}</p>
                                     <p className="text-xs text-muted-foreground mt-1">
                                       {new Date(txn.timestamp).toLocaleString()}
                                     </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-red-600">-₹{txn.amount.toFixed(2)}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userTransactions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No transactions yet</div>
                      ) : (
                        userTransactions.map((txn) => (
                          <Card key={txn.id} className="shadow-sm">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`p-2 rounded-lg ${txn.type === "recharge" ? "bg-green-100" : "bg-blue-100"}`}
                                  >
                                    {txn.type === "recharge" ? (
                                      <Wallet className="h-5 w-5 text-green-600" />
                                    ) : (
                                      <Download className="h-5 w-5 text-blue-600" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-semibold">
                                      {txn.type === "recharge" ? "Wallet Recharge" : txn.registrationNumber}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{txn.description}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {new Date(txn.timestamp).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p
                                    className={`font-bold ${txn.type === "recharge" ? "text-green-600" : "text-red-600"}`}
                                  >
                                    {txn.type === "recharge" ? "+" : "-"}₹{txn.amount.toFixed(2)}
                                  </p>
                                  <Badge
                                    variant={txn.type === "recharge" ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {txn.type === "recharge" ? "Credit" : "Debit"}
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-2xl">All Users ({filteredUsers.length})</CardTitle>
                <div className="flex items-center gap-2 mt-4">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-md"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loadingUsers && <div className="text-sm text-muted-foreground py-3">Loading…</div>}
                  {filteredUsers.map((u) => (
                    <Card key={u.id} className="shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4" onClick={() => handleUserClick(u)}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg">{u.name}</h3>
                              {u.role === "admin" && (
                                <Badge variant="default" className="text-xs">
                                  Admin
                                </Badge>
                              )}
                              <Badge variant={u.isActive !== false ? "default" : "secondary"} className="text-xs">
                                {u.isActive !== false ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                            <div className="flex items-center gap-1 text-sm">
                              <Wallet className="h-4 w-4 text-green-600" />
                              <span className="font-semibold">₹{u.walletBalance.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button variant="outline" size="sm" onClick={() => navigateToCredit(u.id)}>
                              Add Money
                            </Button>
                            {u.role !== "admin" && (
                              <Button
                                variant={u.isActive !== false ? "destructive" : "default"}
                                size="sm"
                                onClick={() => toggleUserStatus(u.id)}
                              >
                                {u.isActive !== false ? (
                                  <>
                                    <UserX className="h-4 w-4 mr-1" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4 mr-1" />
                                    Activate
                                  </>
                                )}
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
          )}
        </div>
      </main>
    </div>
  )
}

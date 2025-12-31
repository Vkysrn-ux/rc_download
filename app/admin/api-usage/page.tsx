"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FileText, ArrowLeft, LogOut, Cloud, RefreshCcw, Search } from "lucide-react"

type RcUsageResponse = {
  ok: boolean
  error?: string
  counts?: { totalLookups: number; surepassHits: number; cacheReused: number }
  externalByVariant?: { variant: string; hits: number }[]
  externalByProvider?: { providerRef: string | null; baseUrl: string | null; variant: string; hits: number }[]
  byVehicle?: { registrationNumber: string; surepassHits: number; cacheReused: number; total: number }[]
  byUser?: { id: string | null; name: string; email: string; surepassHits: number; cacheReused: number; total: number }[]
  recent?: {
    id: string
    registrationNumber: string
    provider: "external" | "cache"
    timestamp: string
    user: { id: string | null; name: string; email: string }
  }[]
}

export default function AdminApiUsagePage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [counts, setCounts] = useState({ totalLookups: 0, surepassHits: 0, cacheReused: 0 })
  const [externalByVariant, setExternalByVariant] = useState<RcUsageResponse["externalByVariant"]>([])
  const [externalByProvider, setExternalByProvider] = useState<RcUsageResponse["externalByProvider"]>([])
  const [byVehicle, setByVehicle] = useState<RcUsageResponse["byVehicle"]>([])
  const [byUser, setByUser] = useState<RcUsageResponse["byUser"]>([])
  const [recent, setRecent] = useState<RcUsageResponse["recent"]>([])

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      router.push("/login")
      return
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, router])

  const load = async () => {
    setLoading(true)
    setError("")
    const res = await fetch("/api/admin/rc-usage")
    const json = (await res.json().catch(() => ({}))) as RcUsageResponse
    if (!res.ok || !json.ok) {
      setError(json?.error || "Failed to load API usage")
      setLoading(false)
      return
    }
    setCounts(json.counts || { totalLookups: 0, surepassHits: 0, cacheReused: 0 })
    setExternalByVariant(json.externalByVariant || [])
    setExternalByProvider(json.externalByProvider || [])
    setByVehicle(json.byVehicle || [])
    setByUser(json.byUser || [])
    setRecent(json.recent || [])
    setLoading(false)
  }

  const filteredRecent = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return recent || []
    return (recent || []).filter((r) => {
      return (
        r.registrationNumber.toLowerCase().includes(q) ||
        r.user.name.toLowerCase().includes(q) ||
        r.user.email.toLowerCase().includes(q)
      )
    })
  }, [recent, search])

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
              <div className="text-lg font-bold text-foreground">API Usage</div>
              <div className="text-xs text-muted-foreground">Surepass hits vs cache reuse</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="bg-transparent">
              <RefreshCcw className="h-4 w-4 sm:mr-2" />
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
        <div className="max-w-7xl mx-auto space-y-6">
          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Surepass Hits</CardTitle>
                  <Cloud className="h-5 w-5 text-sky-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{counts.surepassHits}</div>
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
                <div className="text-3xl font-bold">{counts.cacheReused}</div>
                <p className="text-xs text-muted-foreground mt-1">Served from DB cache</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Lookups</CardTitle>
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{counts.totalLookups}</div>
                <p className="text-xs text-muted-foreground mt-1">External + cache</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">External API Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {(externalByVariant || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No external hits yet</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(externalByVariant || []).map((v) => (
                    <Badge key={v.variant} variant={v.variant === "unknown" ? "outline" : "default"}>
                      {v.variant} {v.hits}
                    </Badge>
                  ))}
                </div>
              )}

              {(externalByProvider || []).length > 0 && (
                <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                  {(externalByProvider || []).map((p) => (
                    <div key={p.providerRef || "unknown"} className="flex items-center justify-between gap-4">
                      <div className="min-w-0 truncate">
                        Provider {p.providerRef || "?"}: {p.variant}
                        {p.baseUrl ? <span className="ml-2 font-mono">{p.baseUrl}</span> : null}
                      </div>
                      <div className="shrink-0">{p.hits}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Top Vehicles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(byVehicle || []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">No data yet</div>
                ) : (
                  (byVehicle || []).map((v) => (
                    <div key={v.registrationNumber} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="font-mono text-sm">{v.registrationNumber}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="secondary">Total {v.total}</Badge>
                        <Badge variant="default">Surepass {v.surepassHits}</Badge>
                        <Badge variant="outline">Cache {v.cacheReused}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Top Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(byUser || []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">No data yet</div>
                ) : (
                  (byUser || []).map((u) => (
                    <div key={u.id || "guest"} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.name}</div>
                        {u.email && <div className="text-xs text-muted-foreground truncate">{u.email}</div>}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="secondary">Total {u.total}</Badge>
                        <Badge variant="default">Surepass {u.surepassHits}</Badge>
                        <Badge variant="outline">Cache {u.cacheReused}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-xl">Recent Lookups</CardTitle>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by user or vehicle…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading && (recent || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : (
                <div className="space-y-2">
                  {filteredRecent.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No lookups found</div>
                  ) : (
                    filteredRecent.map((r) => (
                      <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-mono text-sm">{r.registrationNumber}</div>
                            <Badge variant={r.provider === "external" ? "default" : "outline"}>
                              {r.provider === "external" ? "Surepass" : "Cache"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.user.name}
                            {r.user.email ? ` (${r.user.email})` : ""}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">{new Date(r.timestamp).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

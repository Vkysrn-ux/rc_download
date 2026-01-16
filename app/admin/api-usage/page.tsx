"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, ArrowLeft, LogOut, Cloud, RefreshCcw, Search, ChevronDown, ChevronRight } from "lucide-react"

type RcUsageResponse = {
  ok: boolean
  error?: string
  apiCalls?: { name: string; hits: number; successes: number; failures: number }[]
  counts?: { totalLookups: number; surepassHits: number; cacheReused: number }
  externalByVariant?: { variant: string; hits: number }[]
  externalByProvider?: { providerRef: string | null; baseUrl: string | null; variant: string; hits: number }[]
  cacheByVariant?: { variant: string; hits: number }[]
  cacheByProvider?: { providerRef: string | null; baseUrl: string | null; variant: string; hits: number }[]
  byProvider?: {
    providerRef: string | null
    baseUrl: string | null
    variant: string
    externalHits: number
    cacheHits: number
    totalHits: number
  }[]
  byVehicle?: { registrationNumber: string; surepassHits: number; cacheReused: number; total: number }[]
  byUser?: {
    id: string | null
    name: string
    email: string
    surepassHits: number
    cacheReused: number
    total: number
    externalByVariant?: { variant: string; hits: number }[]
  }[]
  recent?: {
    id: string
    registrationNumber: string
    provider: "external" | "cache"
    providerRef?: string | null
    providerBaseUrl?: string | null
    providerVariant?: string | null
    timestamp: string
    user: { id: string | null; name: string; email: string }
  }[]
}

type RecentRange = "today" | "week" | "month" | "all"

const IST_LOCALE = "en-IN"
const IST_TIMEZONE = "Asia/Kolkata"
const IST_OFFSET_MS = 330 * 60 * 1000
const SOURCE_TZ_OFFSET_MINUTES = Number(process.env.NEXT_PUBLIC_RC_TIMESTAMP_SOURCE_OFFSET_MINUTES ?? "0")
const SOURCE_TZ_OFFSET_MS = Number.isFinite(SOURCE_TZ_OFFSET_MINUTES) ? SOURCE_TZ_OFFSET_MINUTES * 60 * 1000 : 0
const VARIANT_LABELS: Record<string, string> = {
  "cashfree-vrs": "Cashfree",
  "rc-full": "RC-full",
  apnirc: "Apnirc",
  "rc-v2": "RC-v2",
  "rc-lite": "RC-lite",
  unknown: "External",
}

function parseUtcTimestamp(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T")
  const hasZone = /[zZ]|[+-]\d\d(?::?\d\d)?$/.test(normalized)
  if (hasZone) {
    const date = new Date(normalized)
    if (!Number.isFinite(date.getTime())) return null
    return date
  }

  const parts = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!parts) return null
  const [, year, month, day, hour, minute, second] = parts
  const utcMs =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second || "0"),
    ) - SOURCE_TZ_OFFSET_MS
  const date = new Date(utcMs)
  if (!Number.isFinite(date.getTime())) return null
  return date
}

function formatIstTimestamp(value: string) {
  const date = parseUtcTimestamp(value)
  if (!date) return value
  const formatted = new Intl.DateTimeFormat(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)
  return `${formatted} IST (GMT+5:30)`
}

function formatVariantLabel(variant: string) {
  return VARIANT_LABELS[variant] ?? variant
}

function getIstRangeStartUtc(range: RecentRange, nowUtc: Date) {
  if (range === "all") return null

  const istNow = new Date(nowUtc.getTime() + IST_OFFSET_MS)
  const startIst = new Date(istNow)

  if (range === "today") {
    startIst.setUTCHours(0, 0, 0, 0)
    return new Date(startIst.getTime() - IST_OFFSET_MS)
  }

  if (range === "week") {
    const day = startIst.getUTCDay()
    const diff = (day + 6) % 7
    startIst.setUTCDate(startIst.getUTCDate() - diff)
    startIst.setUTCHours(0, 0, 0, 0)
    return new Date(startIst.getTime() - IST_OFFSET_MS)
  }

  if (range === "month") {
    startIst.setUTCDate(1)
    startIst.setUTCHours(0, 0, 0, 0)
    return new Date(startIst.getTime() - IST_OFFSET_MS)
  }

  return null
}

export default function AdminApiUsagePage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [recentRange, setRecentRange] = useState<RecentRange>("today")
  const [counts, setCounts] = useState({ totalLookups: 0, surepassHits: 0, cacheReused: 0 })
  const [apiCalls, setApiCalls] = useState<RcUsageResponse["apiCalls"]>([])
  const [externalByVariant, setExternalByVariant] = useState<RcUsageResponse["externalByVariant"]>([])
  const [externalByProvider, setExternalByProvider] = useState<RcUsageResponse["externalByProvider"]>([])
  const [cacheByVariant, setCacheByVariant] = useState<RcUsageResponse["cacheByVariant"]>([])
  const [cacheByProvider, setCacheByProvider] = useState<RcUsageResponse["cacheByProvider"]>([])
  const [byProvider, setByProvider] = useState<RcUsageResponse["byProvider"]>([])
  const [byVehicle, setByVehicle] = useState<RcUsageResponse["byVehicle"]>([])
  const [byUser, setByUser] = useState<RcUsageResponse["byUser"]>([])
  const [recent, setRecent] = useState<RcUsageResponse["recent"]>([])
  const [topVehiclesOpen, setTopVehiclesOpen] = useState(false)
  const [loadingTopVehicles, setLoadingTopVehicles] = useState(false)
  const [topVehiclesLoaded, setTopVehiclesLoaded] = useState(false)

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
    const res = await fetch(
      "/api/admin/rc-usage?include=apiCalls,counts,externalByVariant,externalByProvider,cacheByVariant,cacheByProvider,byProvider,byUser,recent",
    )
    const json = (await res.json().catch(() => ({}))) as RcUsageResponse
    if (!res.ok || !json.ok) {
      setError(json?.error || "Failed to load API usage")
      setLoading(false)
      return
    }
    setApiCalls(json.apiCalls || [])
    setCounts(json.counts || { totalLookups: 0, surepassHits: 0, cacheReused: 0 })
    setExternalByVariant(json.externalByVariant || [])
    setExternalByProvider(json.externalByProvider || [])
    setCacheByVariant(json.cacheByVariant || [])
    setCacheByProvider(json.cacheByProvider || [])
    setByProvider(json.byProvider || [])
    setByVehicle([])
    setTopVehiclesLoaded(false)
    setByUser(json.byUser || [])
    setRecent(json.recent || [])
    setLoading(false)
  }

  const loadTopVehicles = async () => {
    setLoadingTopVehicles(true)
    setError("")
    const res = await fetch("/api/admin/rc-usage?include=byVehicle")
    const json = (await res.json().catch(() => ({}))) as RcUsageResponse
    if (!res.ok || !json.ok) {
      setError(json?.error || "Failed to load top vehicles")
      setLoadingTopVehicles(false)
      return
    }
    setByVehicle(json.byVehicle || [])
    setTopVehiclesLoaded(true)
    setLoadingTopVehicles(false)
  }

  useEffect(() => {
    if (topVehiclesOpen && !topVehiclesLoaded && !loadingTopVehicles) {
      void loadTopVehicles()
    }
  }, [topVehiclesOpen, topVehiclesLoaded, loadingTopVehicles])

  const filteredRecent = useMemo(() => {
    const nowUtc = new Date()
    const startUtc = getIstRangeStartUtc(recentRange, nowUtc)

    const withinRange = (recent || []).filter((r) => {
      const timestamp = parseUtcTimestamp(r.timestamp)
      if (!timestamp || !Number.isFinite(timestamp.getTime())) return false
      if (startUtc && timestamp < startUtc) return false
      if (timestamp > nowUtc) return false
      return true
    })

    const q = search.trim().toLowerCase()
    if (!q) return withinRange
    return withinRange.filter((r) => {
      return (
        r.registrationNumber.toLowerCase().includes(q) ||
        r.user.name.toLowerCase().includes(q) ||
        r.user.email.toLowerCase().includes(q)
      )
    })
  }, [recent, search, recentRange])

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

           <div className="grid md:grid-cols-4 gap-6">
             {(apiCalls || []).map((api) => (
               <Card key={api.name} className="shadow-md hover:shadow-lg transition-shadow">
                 <CardHeader className="pb-3">
                   <div className="flex items-center justify-between">
                     <CardTitle className="text-sm font-medium text-muted-foreground">{api.name} Hits</CardTitle>
                     <Cloud className="h-5 w-5 text-sky-600" />
                   </div>
                 </CardHeader>
                 <CardContent>
                   <div className="text-3xl font-bold">{api.hits}</div>
                   <p className="text-xs text-muted-foreground mt-1">
                     Success {api.successes} · Failed {api.failures}
                   </p>
                 </CardContent>
               </Card>
             ))}
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
              <CardTitle className="text-xl">Cache Source Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {(cacheByVariant || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No cache reuse yet</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(cacheByVariant || []).map((v) => (
                    <Badge key={v.variant} variant={v.variant === "unknown" ? "outline" : "secondary"}>
                      {v.variant} {v.hits}
                    </Badge>
                  ))}
                </div>
              )}

              {(cacheByProvider || []).length > 0 && (
                <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                  {(cacheByProvider || []).map((p) => (
                    <div key={p.providerRef || "unknown"} className="flex items-center justify-between gap-4">
                      <div className="min-w-0 truncate">
                        Source {p.providerRef || "?"}: {p.variant}
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
              <CardTitle className="text-xl">Total by Provider</CardTitle>
            </CardHeader>
            <CardContent>
              {(byProvider || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No data yet</div>
              ) : (
                <div className="space-y-2 text-xs">
                  {(byProvider || []).map((p) => (
                    <div key={p.providerRef || "unknown"} className="flex items-center justify-between gap-4 border-b py-2 last:border-0">
                      <div className="min-w-0">
                        <div className="truncate text-muted-foreground">
                          Provider {p.providerRef || "?"}: {p.variant}
                          {p.baseUrl ? <span className="ml-2 font-mono">{p.baseUrl}</span> : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">Total {p.totalHits}</Badge>
                          <Badge variant="default">External {p.externalHits}</Badge>
                          <Badge variant="outline">Cache {p.cacheHits}</Badge>
                        </div>
                      </div>
                      <div className="shrink-0 text-muted-foreground">{p.totalHits}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 text-left"
                onClick={() => setTopVehiclesOpen((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  {topVehiclesOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-xl">Top Vehicles</CardTitle>
                </div>
                <div className="text-xs text-muted-foreground">
                  {topVehiclesLoaded ? `${(byVehicle || []).length} shown` : "Click to load"}
                </div>
              </button>
            </CardHeader>
            {topVehiclesOpen ? (
              <CardContent>
                {loadingTopVehicles ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : (
                  <div className="space-y-2">
                    {(byVehicle || []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">No data yet</div>
                    ) : (
                      (byVehicle || []).map((v) => (
                        <div
                          key={v.registrationNumber}
                          className="flex items-center justify-between py-2 border-b last:border-0"
                        >
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
                )}
              </CardContent>
            ) : null}
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
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="secondary">Total {u.total}</Badge>
                        {(u.externalByVariant || []).length > 0 ? (
                          (u.externalByVariant || []).map((v) => (
                            <Badge key={v.variant} variant="default">
                              {formatVariantLabel(v.variant)} {v.hits}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="default">Surepass {u.surepassHits}</Badge>
                        )}
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
                  <Select value={recentRange} onValueChange={(value) => setRecentRange(value as typeof recentRange)}>
                    <SelectTrigger size="sm" className="w-[140px]">
                      <SelectValue placeholder="Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This week</SelectItem>
                      <SelectItem value="month">This month</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
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
                              {r.provider === "external"
                                ? `External${r.providerRef ? ` #${r.providerRef}` : ""}`
                                : `Cache${r.providerRef ? ` ← #${r.providerRef}` : ""}`}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.user.name}
                            {r.user.email ? ` (${r.user.email})` : ""}
                          </div>
                          {r.providerBaseUrl ? (
                            <div className="text-[10px] text-muted-foreground truncate font-mono">
                              {(r.providerVariant || "unknown").toString()} {r.providerBaseUrl}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatIstTimestamp(r.timestamp)}</div>
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

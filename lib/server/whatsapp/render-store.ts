import crypto from "crypto"
import type { NormalizedRCData } from "@/lib/server/rc-normalize"

const TTL = 5 * 60 * 1000

// Survive hot-module reloads in dev
const g = globalThis as any
if (!g.__rcRenderStore) g.__rcRenderStore = new Map<string, { data: NormalizedRCData; expires: number }>()
const store: Map<string, { data: NormalizedRCData; expires: number }> = g.__rcRenderStore

export function storeRenderToken(data: NormalizedRCData): string {
  const token = crypto.randomUUID()
  store.set(token, { data, expires: Date.now() + TTL })
  // Prune expired
  const now = Date.now()
  for (const [k, v] of store.entries()) {
    if (v.expires < now) store.delete(k)
  }
  return token
}

export function getRenderData(token: string): NormalizedRCData | null {
  const entry = store.get(token)
  if (!entry) return null
  if (entry.expires < Date.now()) {
    store.delete(token)
    return null
  }
  return entry.data
}

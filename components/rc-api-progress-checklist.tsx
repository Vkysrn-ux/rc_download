"use client"

import { CheckCircle2, Circle, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

export type RcApiProgressResult = { status: "success"; usedIndex: number } | { status: "failure" }
export type RcApiStepStatus = "pending" | "active" | "success" | "failure"

type RcApiProgressChecklistProps = {
  active: boolean
  steps?: RcApiStepStatus[] | null
  result?: RcApiProgressResult
  className?: string
}

const STEPS = [
  { id: "rc-v2", label: "RC-v2" },
  { id: "rc-full", label: "rc-full" },
  { id: "rc-lite", label: "rc-lite" },
  { id: "apnirc", label: "apnirc" },
] as const

function clampUsedIndex(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(Math.trunc(value), 0), STEPS.length - 1)
}

function normalizeSteps(value: RcApiStepStatus[] | null | undefined): RcApiStepStatus[] | null {
  if (!value) return null
  const normalized = value.slice(0, STEPS.length)
  while (normalized.length < STEPS.length) normalized.push("pending")
  return normalized
}

export function rcApiResultFromLookupResponse(json: any): RcApiProgressResult | null {
  const provider = typeof json?.provider === "string" ? json.provider : ""
  const providerRef = typeof json?.providerRef === "string" ? json.providerRef : ""
  const ok = Boolean(json?.ok)

  if (!ok) return { status: "failure" }

  if (provider !== "external") return { status: "success", usedIndex: 0 }

  if (providerRef === "apnirc-b2b") return { status: "success", usedIndex: 3 }

  const index = Number.parseInt(providerRef, 10)
  if (!Number.isFinite(index) || index < 1) return { status: "success", usedIndex: 0 }
  return { status: "success", usedIndex: clampUsedIndex(index - 1) }
}

function stepsFromResult(result: RcApiProgressResult | undefined | null): RcApiStepStatus[] | null {
  if (!result) return null
  if (result.status === "failure") return Array.from({ length: STEPS.length }, () => "failure")
  const usedIndex = clampUsedIndex(result.usedIndex)
  return STEPS.map((_, index) => (index < usedIndex ? "failure" : index === usedIndex ? "success" : "pending"))
}

export function RcApiProgressChecklist({ active, steps, result, className }: RcApiProgressChecklistProps) {
  const resolvedSteps =
    normalizeSteps(steps) ??
    stepsFromResult(result?.status === "success" ? { ...result, usedIndex: clampUsedIndex(result.usedIndex) } : result) ??
    (active ? (["active", "pending", "pending", "pending"] as RcApiStepStatus[]) : (["pending", "pending", "pending", "pending"] as RcApiStepStatus[]))

  return (
    <div
      className={cn("rounded-2xl border bg-white/80 backdrop-blur-sm shadow-sm px-4 py-3", className)}
      aria-live="polite"
      aria-busy={active}
    >
      <div className="space-y-2">
        {STEPS.map((step, index) => {
          const status = resolvedSteps[index] ?? "pending"

          return (
            <div key={step.id} className="flex items-center gap-3 text-sm">
              {status === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              ) : status === "failure" ? (
                <XCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
              ) : status === "active" ? (
                <Spinner className="h-5 w-5 text-emerald-600" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              )}

              <div
                className={cn(
                  status === "pending" ? "text-muted-foreground" : status === "failure" ? "text-red-700" : "text-foreground",
                )}
              >
                {index + 1}. {step.label} API{status === "active" ? "..." : ""}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

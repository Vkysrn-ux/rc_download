"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

type RcDownloadStep = 1 | 2 | 3

type StepDef = {
  title: string
  subtitle: string
}

const STEPS: StepDef[] = [
  { title: "Enter Vehicle", subtitle: "Input registration number" },
  { title: "Verify & Price", subtitle: "Confirm deduction" },
  { title: "Download RC", subtitle: "Get masked copy" },
]

function StepCircle({ index, state }: { index: number; state: "done" | "active" | "todo" }) {
  return (
    <div
      className={cn(
        "h-9 w-9 rounded-full border flex items-center justify-center text-sm font-semibold shrink-0",
        state === "done" && "bg-blue-600 border-blue-600 text-white",
        state === "active" && "bg-blue-50 border-blue-600 text-blue-700",
        state === "todo" && "bg-white border-muted text-muted-foreground",
      )}
      aria-hidden="true"
    >
      {state === "done" ? <Check className="h-4 w-4" /> : index}
    </div>
  )
}

export function RcDownloadStepper({ step, className }: { step: RcDownloadStep; className?: string }) {
  return (
    <nav aria-label="RC download steps" className={cn("w-full", className)}>
      <div className="flex items-start w-full">
        {STEPS.map((s, idx) => {
          const index = idx + 1
          const state: "done" | "active" | "todo" =
            index < step ? "done" : index === step ? "active" : "todo"

          return (
            <div key={s.title} className="flex items-start flex-1">
              <div className="flex flex-col items-center text-center min-w-0">
                <StepCircle index={index} state={state} />
                <div className={cn("mt-2 text-sm font-semibold", state === "active" && "text-blue-700")}>
                  {s.title}
                </div>
                <div className="text-xs text-muted-foreground">{s.subtitle}</div>
              </div>

              {idx < STEPS.length - 1 && (
                <div className="flex-1 px-3 pt-4" aria-hidden="true">
                  <div className={cn("h-[2px] rounded-full", step > index ? "bg-blue-600" : "bg-muted")} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}

"use client"

import { FileText } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import ServiceCatalog from "@/components/service-catalog"
import { useRouter } from "next/navigation"

export default function ServicesPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-blue-50/30 to-background">
      <header className="border-b bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-2 text-foreground"
            onClick={() => router.push("/")}
          >
            <div className="p-2 bg-primary rounded-lg">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <div className="text-lg font-bold leading-tight">Services</div>
              <div className="text-xs text-muted-foreground">Choose your service</div>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Button onClick={() => router.push("/dashboard")}>Dashboard</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => router.push("/login")}>
                  Login
                </Button>
                <Button onClick={() => router.push("/signup")}>Register</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <ServiceCatalog />
        </div>
      </main>
    </div>
  )
}


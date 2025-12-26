"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { ArrowLeft, Copy, CheckCircle2 } from "lucide-react"
import { useState } from "react"

export default function SetupPage() {
  const router = useRouter()
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const sql = `-- Create an admin user after signing up:
UPDATE users SET role='admin', email_verified_at=NOW() WHERE email='admin@example.com';`

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Setup</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Database</CardTitle>
              <CardDescription>Run the schema and configure MySQL env vars</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>Schema file: <code className="bg-muted px-2 py-1 rounded">db/schema.sql</code></div>
              <div>Env template: <code className="bg-muted px-2 py-1 rounded">.env.example</code></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email</CardTitle>
              <CardDescription>Verification + OTP are sent via SMTP (or logged if SMTP isn’t configured)</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              If <code className="bg-muted px-2 py-1 rounded">SMTP_HOST</code>/<code className="bg-muted px-2 py-1 rounded">SMTP_USER</code>/<code className="bg-muted px-2 py-1 rounded">SMTP_PASS</code> are missing, the server logs the verification link / OTP code.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin</CardTitle>
              <CardDescription>Make a user admin (example SQL)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{sql}</pre>
              <Button variant="outline" className="bg-transparent" onClick={() => copy(sql, "sql")}>
                {copied === "sql" ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                Copy SQL
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}


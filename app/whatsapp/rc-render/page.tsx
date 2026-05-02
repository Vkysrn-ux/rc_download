import { Suspense } from "react"
import RcRenderClient from "./RcRenderClient"

export const dynamic = "force-dynamic"

export default async function RcRenderPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  if (!token) {
    return <div style={{ padding: 20, color: "red" }}>Missing token</div>
  }

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <style>{`* { margin: 0; padding: 0; box-sizing: border-box; } body { background: white; }`}</style>
      </head>
      <body>
        <Suspense fallback={<div style={{ padding: 20 }}>Loading…</div>}>
          <RcRenderClient token={token} />
        </Suspense>
      </body>
    </html>
  )
}

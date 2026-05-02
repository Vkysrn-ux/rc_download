"use client"

import { useEffect, useState } from "react"
import { RCDocumentTemplate } from "@/components/rc-document-template"

interface RCData {
  registrationNumber: string
  ownerName: string
  vehicleClass: string
  maker: string
  model: string
  fuelType: string
  registrationDate: string
  chassisNumber: string
  engineNumber: string
  address: string
  color?: string
  bodyType?: string
  seatingCapacity?: string
  manufacturingDate?: string
  cylinders?: string
  cubicCapacity?: string
  horsePower?: string
  wheelBase?: string
  financier?: string
  registrationAuthority?: string
  registrationValidity?: string
  emissionNorms?: string
  unladenWeight?: string
}

export default function RcRenderClient({ token }: { token: string }) {
  const [data, setData] = useState<RCData | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/whatsapp/rc-data?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setData(json.data)
        else setError(json.error || "Failed")
      })
      .catch(() => setError("Network error"))
  }, [token])

  // Wait 2.5s after data loads so QR code finishes rendering
  useEffect(() => {
    if (!data) return
    const t = setTimeout(() => setReady(true), 2500)
    return () => clearTimeout(t)
  }, [data])

  if (error) return <div style={{ padding: 20, color: "red" }}>{error}</div>
  if (!data) return <div id="rc-loading" style={{ padding: 20 }}>Loading…</div>

  return (
    <div
      id="rc-portrait-container"
      style={{
        display: "inline-block",
        background: "white",
        padding: "20px",
      }}
    >
      <RCDocumentTemplate data={data} side="front" id="rc-front" />
      <div style={{ height: 20 }} />
      <RCDocumentTemplate data={data} side="back" id="rc-back" />
      {ready && <div id="rc-portrait-ready" style={{ display: "none" }} />}
    </div>
  )
}

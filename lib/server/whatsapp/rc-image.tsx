import { ImageResponse } from "next/og"
import type { NormalizedRCData } from "@/lib/server/rc-normalize"

function row(label: string, value: string | undefined) {
  if (!value) return null
  return (
    <div style={{ display: "flex", flexDirection: "row", marginBottom: "8px", gap: "8px" }}>
      <span style={{ color: "#94a3b8", fontSize: "13px", minWidth: "160px" }}>{label}</span>
      <span style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 600, flex: 1 }}>{value}</span>
    </div>
  )
}

export async function generateRcImage(data: NormalizedRCData): Promise<Buffer> {
  const img = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#0f172a",
          padding: "28px 32px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", width: "10px", height: "36px", background: "#22c55e", borderRadius: "3px" }} />
            <span style={{ color: "#f1f5f9", fontSize: "18px", fontWeight: 700, letterSpacing: "2px" }}>
              REGISTRATION CERTIFICATE
            </span>
          </div>
          <span style={{ color: "#475569", fontSize: "12px" }}>vehiclercdownload.com</span>
        </div>

        {/* Reg number banner */}
        <div
          style={{
            display: "flex",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "8px",
            padding: "14px 20px",
            marginBottom: "20px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "#22c55e", fontSize: "30px", fontWeight: 800, letterSpacing: "4px" }}>
            {data.registrationNumber}
          </span>
          {data.vehicleClass && (
            <span
              style={{
                background: "#0f4e27",
                color: "#22c55e",
                fontSize: "12px",
                fontWeight: 700,
                padding: "4px 12px",
                borderRadius: "20px",
                border: "1px solid #22c55e",
              }}
            >
              {data.vehicleClass}
            </span>
          )}
        </div>

        {/* Two column grid */}
        <div style={{ display: "flex", flexDirection: "row", gap: "24px", flex: 1 }}>
          {/* Left column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              background: "#1e293b",
              borderRadius: "8px",
              padding: "16px 20px",
            }}
          >
            <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", marginBottom: "12px" }}>
              OWNER &amp; VEHICLE
            </span>
            {row("Owner", data.ownerName)}
            {row("Maker", data.maker)}
            {row("Model", data.model)}
            {row("Fuel Type", data.fuelType)}
            {row("Color", data.color)}
            {row("Body Type", data.bodyType)}
            {row("Seating", data.seatingCapacity)}
            {row("Emission", data.emissionNorms)}
          </div>

          {/* Right column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              background: "#1e293b",
              borderRadius: "8px",
              padding: "16px 20px",
            }}
          >
            <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", marginBottom: "12px" }}>
              REGISTRATION
            </span>
            {row("Reg Date", data.registrationDate)}
            {row("Valid Till", data.registrationValidity)}
            {row("Authority", data.registrationAuthority)}
            {row("Mfg Date", data.manufacturingDate)}
            {row("Financier", data.financier)}
            {row("Chassis No", data.chassisNumber ? data.chassisNumber.slice(0, 8) + "****" : undefined)}
            {row("Engine No", data.engineNumber ? data.engineNumber.slice(0, 6) + "****" : undefined)}
          </div>
        </div>

        {/* Address */}
        {data.address && (
          <div
            style={{
              display: "flex",
              background: "#1e293b",
              borderRadius: "8px",
              padding: "10px 20px",
              marginTop: "12px",
              gap: "8px",
            }}
          >
            <span style={{ color: "#94a3b8", fontSize: "12px", minWidth: "60px" }}>Address</span>
            <span style={{ color: "#cbd5e1", fontSize: "12px", flex: 1 }}>{data.address.slice(0, 120)}</span>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "10px",
            color: "#334155",
            fontSize: "11px",
          }}
        >
          Generated via vehiclercdownload.com
        </div>
      </div>
    ),
    { width: 800, height: 660 },
  )

  return Buffer.from(await img.arrayBuffer())
}

export async function generatePanImage(panNumber: string, data: Record<string, any>): Promise<Buffer> {
  const safeStr = (v: any) => {
    if (v === null || v === undefined) return ""
    return String(v)
  }
  
  const namePanCard = safeStr(data?.name_pan_card || data?.name || data?.full_name || data?.registered_name)
  const firstName = safeStr(data?.first_name)
  const registeredName = safeStr(data?.registered_name || data?.name_pan_card)
  const gender = safeStr(data?.gender).toUpperCase()
  const maskedAadhaar = safeStr(data?.masked_aadhaar_number || data?.masked_aadhaar)
  const mobileNumber = safeStr(data?.mobile_number)
  
  let addressStr = ""
  if (data?.address) {
    if (typeof data.address === 'string') {
      addressStr = data.address
    } else {
      addressStr = [
        data.address.full_address, 
        data.address.street, 
        data.address.city, 
        data.address.state, 
        data.address.zip, 
        data.address.country
      ].filter(Boolean).join(", ")
    }
  }
  if (!addressStr && data?.full_address) addressStr = safeStr(data.full_address)
  
  const status = safeStr(data?.status || data?.pan_status || "VALID").toUpperCase()
  const lastName = safeStr(data?.last_name)
  const panType = safeStr(data?.type || data?.pan_type || data?.category || "Individual or Person")
  const dob = safeStr(data?.date_of_birth || data?.dob)
  const email = safeStr(data?.email)
  const aadhaarLink = data?.aadhaar_linked !== undefined ? (data?.aadhaar_linked ? "True" : "False") : ""
  const panRefId = safeStr(data?.reference_id || data?.pan_ref_id)
  const message = safeStr(data?.message || "PAN verified successfully")

  const lightRow = (label: string, value: string) => {
    if (!value) return null
    return (
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", padding: "12px 0", gap: "16px" }}>
        <span style={{ color: "#6b7280", fontSize: "14px", flexShrink: 0 }}>{label}</span>
        <span style={{ color: "#111827", fontSize: "14px", fontWeight: 600, textAlign: "right", display: "flex", justifyContent: "flex-end" }}>{value}</span>
      </div>
    )
  }

  const img = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#ffffff",
          padding: "24px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "20px 24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#111827", marginBottom: "16px" }}>
            Result
          </div>
          
          <div style={{ display: "flex", flexDirection: "row", gap: "32px", width: "100%" }}>
            {/* Left Column */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              {lightRow("Name Pan Card", namePanCard)}
              {lightRow("First Name", firstName)}
              {lightRow("Registered Name", registeredName)}
              {lightRow("Gender", gender)}
              {lightRow("Masked Aadhaar", maskedAadhaar)}
              {lightRow("Mobile number", mobileNumber)}
              {lightRow("Address", addressStr)}
              {lightRow("Status", status)}
            </div>
            
            {/* Right Column */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              {lightRow("PAN", panNumber)}
              {lightRow("Last Name", lastName)}
              {lightRow("PAN Type", panType)}
              {lightRow("Date of Birth", dob)}
              {lightRow("Email", email)}
              {lightRow("Aadhaar Link", aadhaarLink)}
              {lightRow("PAN Ref. ID", panRefId)}
              {lightRow("Message", message)}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 850, height: 480 },
  )

  return Buffer.from(await img.arrayBuffer())
}

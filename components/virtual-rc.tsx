"use client"

import React, { useMemo } from "react"
import QRCode from "qrcode"

type VirtualRcTemplateProps = {
  data: any
  id?: string
  showReturnButton?: boolean
  returnHref?: string
  returnLabel?: string
}

function firstString(value: any): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function firstStringFromKeys(data: any, keys: string[]): string {
  for (const key of keys) {
    const found = firstString(data?.[key])
    if (found) return found
  }
  return ""
}

export default function VirtualRcTemplate({
  data,
  id,
  showReturnButton = false,
  returnHref = "/",
  returnLabel = "Return to Home",
}: VirtualRcTemplateProps) {
  const registrationNumber = String(data?.registrationNumber || "")
  const ownerName = String(data?.ownerName || "")
  const vehicleClass = String(data?.vehicleClass || "")
  const maker = String(data?.maker || "")
  const model = String(data?.model || "")
  const fuelType = String(data?.fuelType || "")
  const registrationDate = String(data?.registrationDate || "")
  const chassisNumber = String(data?.chassisNumber || "")
  const engineNumber = String(data?.engineNumber || "")
  const registrationAuthority = String(data?.registrationAuthority || "")
  const emissionNorms = String(data?.emissionNorms || "")
  const financier = String(data?.financier || "")
  const color = String(data?.color || "")
  const seatingCapacity = String(data?.seatingCapacity || "")
  const address = String(data?.address || "")
  const unladenWeight = String(data?.unladenWeight || "")

  const relationName = firstStringFromKeys(data, [
    "sonWifeDaughterOf",
    "sonDaughterWifeOf",
    "guardianName",
    "fatherName",
    "husbandName",
    "relationName",
  ])
  const ownership = firstStringFromKeys(data, ["ownership", "ownershipType", "ownerType"])
  const vehicleDescription = firstStringFromKeys(data, ["vehicleDescription", "vehicle_description", "description"])
  const taxValidUpto = firstStringFromKeys(data, ["taxValidUpto", "taxValidity", "tax_valid_upto"])
  const standingCapacity = firstStringFromKeys(data, ["standingCapacity", "standing_capacity"])
  const insuranceCompany = firstStringFromKeys(data, ["insuranceCompany", "insurance_company"])
  const insurancePolicyNo = firstStringFromKeys(data, ["insurancePolicyNo", "insurancePolicyNumber", "insurance_policy_no"])
  const insuranceValidUpto = firstStringFromKeys(data, ["insuranceValidUpto", "insuranceValidity", "insurance_valid_upto"])
  const fitnessValidUpto = firstStringFromKeys(data, ["fitnessValidUpto", "fitnessValidity", "fitness_valid_upto"])
  const puccNo = firstStringFromKeys(data, ["puccNo", "puccNumber", "pucNo", "pucNumber"])
  const puccValidUpto = firstStringFromKeys(data, ["puccValidUpto", "puccValidity", "pucValidUpto", "pucValidity"])

  const qrPayload = useMemo(
    () => `${registrationNumber}|${ownerName}|${chassisNumber}`,
    [registrationNumber, ownerName, chassisNumber],
  )
  const [qrDataUrl, setQrDataUrl] = React.useState<string>("")

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const dataUrl = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: "M", margin: 0, width: 220 })
        if (!cancelled) setQrDataUrl(dataUrl)
      } catch {
        if (!cancelled) setQrDataUrl("")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [qrPayload])

  const blue = "#0ea5e9"
  const text = "#0f172a"
  const muted = "#334155"
  const border = "#e5e7eb"

  const displayValue = (value: string) => (value || "").trim() || ".........."

  const rows: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: "Name", value: ownerName },
    { label: "Son / Daughter / Wife of", value: relationName },
    { label: "Ownership", value: ownership },
    { label: "Chassis No.", value: chassisNumber, mono: true },
    { label: "Engine No.", value: engineNumber, mono: true },
    { label: "Maker Name", value: maker },
    { label: "Model Name", value: model },
    { label: "Registration Date", value: registrationDate },
    { label: "Tax Valid UpTo", value: taxValidUpto },
    { label: "Vehicle Class", value: vehicleClass },
    { label: "Vehicle Description", value: vehicleDescription },
    { label: "Fuel Type", value: fuelType },
    { label: "Emission Norm", value: emissionNorms },
    { label: "Color", value: color },
    { label: "Seat Capacity", value: seatingCapacity },
    { label: "Standing Capacity", value: standingCapacity },
    { label: "Financier", value: financier },
    { label: "Insurance Company", value: insuranceCompany },
    { label: "Insurance Policy No.", value: insurancePolicyNo },
    { label: "Insurance Valid UpTo", value: insuranceValidUpto },
    { label: "Fitness Valid UpTo", value: fitnessValidUpto },
    { label: "PUCC No.", value: puccNo },
    { label: "PUCC Valid UpTo", value: puccValidUpto },
    { label: "Unladen Weight", value: unladenWeight },
    { label: "Registration Authority", value: registrationAuthority },
  ]

  return (
    <div
      id={id}
      style={{
        width: 360,
        background: "#ffffff",
        color: text,
        borderRadius: 14,
        overflow: "hidden",
        fontFamily: "Arial, Helvetica, sans-serif",
        border: `1px solid ${border}`,
      }}
    >
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", width: 232, height: 232 }}>
            <div
              style={{
                position: "absolute",
                inset: 10,
                borderRadius: 10,
                border: `1px solid ${border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ffffff",
              }}
            >
              {qrDataUrl ? <img src={qrDataUrl} alt="QR" style={{ width: 200, height: 200 }} /> : null}
            </div>

            <div style={{ position: "absolute", left: 0, top: 0, width: 18, height: 18, borderLeft: `3px solid ${blue}`, borderTop: `3px solid ${blue}`, borderRadius: 2 }} />
            <div style={{ position: "absolute", right: 0, top: 0, width: 18, height: 18, borderRight: `3px solid ${blue}`, borderTop: `3px solid ${blue}`, borderRadius: 2 }} />
            <div style={{ position: "absolute", left: 0, bottom: 0, width: 18, height: 18, borderLeft: `3px solid ${blue}`, borderBottom: `3px solid ${blue}`, borderRadius: 2 }} />
            <div style={{ position: "absolute", right: 0, bottom: 0, width: 18, height: 18, borderRight: `3px solid ${blue}`, borderBottom: `3px solid ${blue}`, borderRadius: 2 }} />
          </div>
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            textAlign: "center",
            color: text,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
          {registrationNumber ? `“${registrationNumber}”` : ""}
        </div>

        <div style={{ marginTop: 12, fontSize: 13, fontWeight: 800 }}>Owner Details</div>
        <div style={{ height: 1, background: border, marginTop: 8, marginBottom: 10 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          {rows.map((row, index) => (
            <div
              key={`${row.label}:${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                columnGap: 12,
                alignItems: "baseline",
                paddingBottom: 6,
                borderBottom: "1px dotted #cbd5e1",
              }}
            >
              <div style={{ fontSize: 11.5, color: muted }}>{row.label}</div>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  textAlign: "right",
                  color: blue,
                  fontFamily: row.mono ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" : "inherit",
                  wordBreak: "break-word",
                }}
              >
                {displayValue(row.value)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 10, fontSize: 11.5, color: blue }}>
          Tap to check the Vehicle Impound and Seizure Document Status
        </div>

        <div style={{ marginTop: 10, fontSize: 10.5, color: muted, lineHeight: 1.35 }}>
          If status of pollution certificate, insurance, tax etc. are not available above, same may be verified from physical
          documents.
        </div>
        <div style={{ marginTop: 8, fontSize: 10.5, color: muted, lineHeight: 1.35 }}>
          Note: This information for the certificate of Registration is generated by mParivahan as per data provided by the
          issuing authority. In the National Registry of Ministry of Road Transport and Highways. This document is valid as
          per the Act 1988 when used electronically.
        </div>

        {address.trim() ? (
          <div style={{ marginTop: 10, fontSize: 10.5, color: muted, lineHeight: 1.35 }}>
            <span style={{ fontWeight: 700 }}>Address: </span>
            {address.trim()}
          </div>
        ) : null}

        {showReturnButton ? (
          <a
            href={returnHref}
            style={{
              display: "block",
              marginTop: 14,
              width: "100%",
              background: blue,
              color: "#ffffff",
              textDecoration: "none",
              textAlign: "center",
              padding: "12px 14px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {returnLabel}
          </a>
        ) : null}
      </div>
    </div>
  )
}

"use client"

import type { CSSProperties } from "react"
import { useMemo, useState } from "react"
import QRCode from "qrcode"

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

interface RCDocumentTemplateProps {
  data: RCData
  side: "front" | "back"
  id?: string
}

const CARD_WIDTH_PX = 640
// Card itself is ~1.585 aspect ratio (matches the sample RC card).
const CARD_HEIGHT_PX = 404

const SIDE_TEMPLATE_CANDIDATES = {
  // Avoid repeated 404s by only requesting the shipped assets.
  front: ["/rc-template/front.jpg"],
  back: ["/rc-template/back.jpg"],
} as const

const COMBINED_TEMPLATE_CANDIDATES = ["/rc-template/template.jpg"] as const

const COMBINED_TEMPLATE_CROP = {
  // Fractions derived from the uploaded 1283×449 combined image:
  // left card ≈ x=35,y=24,w=588,h=371; right card ≈ x=655,y=24,w=594,h=374.
  front: { x: 35 / 1283, y: 24 / 449, w: 588 / 1283, h: 371 / 449 },
  back: { x: 655 / 1283, y: 24 / 449, w: 594 / 1283, h: 374 / 449 },
} as const

const MIN_QR_VERSION = 5

const HEADER_FONT_FAMILY = '"Arial Black", Arial, Helvetica, sans-serif'

const CIRCLE_TEXT_POSITIONS = {
  front: {
    nt: { left: 550, top: 22, size: 28 },
    state: { left: 588, top: 22, size: 28 },
  },
  back: {
    nt: { left: 19, top: 28, size: 28 },
    state: { left: 56, top: 28, size: 28 },
  },
} as const

function formatDateDdMmYyyy(dateString: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)
}

function formatMonthYear(dateString: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat("en-GB", { month: "2-digit", year: "numeric" }).format(date)
}

function addYearsDdMmYyyy(dateString: string, years: number) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ""
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + years)
  return formatDateDdMmYyyy(next.toISOString())
}

function GovtEmblem() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
      <path
        d="M32 3c-6 0-11 5-11 11 0 2 .5 4 1.5 5.7-4.8 2.2-8 7-8 12.6v19.2c0 .8.6 1.5 1.5 1.5h29c.8 0 1.5-.7 1.5-1.5V32.3c0-5.6-3.2-10.4-8-12.6C42.5 18 43 16 43 14c0-6-5-11-11-11Zm0 6.2c2.7 0 4.8 2.1 4.8 4.8S34.7 18.8 32 18.8 27.2 16.7 27.2 14 29.3 9.2 32 9.2Z"
        fill="#333"
        opacity="0.9"
      />
      <path d="M18 58c4.5 2.2 9.4 3.3 14 3.3S41.5 60.2 46 58" stroke="#333" strokeWidth="3" fill="none" />
    </svg>
  )
}

function RcWaveBackground({ variant }: { variant: "front" | "back" }) {
  const stroke = variant === "front" ? "rgba(120, 170, 205, 0.35)" : "rgba(120, 170, 205, 0.32)"
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 ${CARD_WIDTH_PX} ${CARD_HEIGHT_PX}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`rc-bg-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9fbff" />
          <stop offset="0.45" stopColor="#dff4ff" />
          <stop offset="1" stopColor="#e8f7ff" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={CARD_WIDTH_PX} height={CARD_HEIGHT_PX} fill={`url(#rc-bg-${variant})`} />
      <g fill="none" stroke={stroke} strokeWidth="1.2">
        <path d="M280 10 C 410 70, 520 30, 640 85" />
        <path d="M240 40 C 370 120, 530 55, 640 125" />
        <path d="M210 80 C 360 170, 520 105, 640 170" />
        <path d="M190 125 C 360 220, 520 155, 640 215" />
        <path d="M180 175 C 360 275, 520 205, 640 265" />
        <path d="M175 230 C 360 335, 520 260, 640 315" />
        <path d="M180 285 C 360 400, 520 315, 640 370" />
      </g>
      <g opacity="0.12" fill="#7aa7c8">
        <circle cx="580" cy="315" r="120" />
      </g>
    </svg>
  )
}

function ChipGraphic() {
  return (
    <svg viewBox="0 0 180 130" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7e6a5" />
          <stop offset="0.55" stopColor="#e3bf62" />
          <stop offset="1" stopColor="#d2a24a" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="180" height="130" rx="14" fill="url(#chip)" />
      <g fill="none" stroke="rgba(80,55,20,0.65)" strokeWidth="3">
        <path d="M32 28 h116" />
        <path d="M32 102 h116" />
        <path d="M32 28 v74" />
        <path d="M148 28 v74" />
        <path d="M68 28 v74" />
        <path d="M112 28 v74" />
        <path d="M32 65 h116" />
        <path d="M68 50 h44" />
        <path d="M68 80 h44" />
      </g>
      <g opacity="0.22" fill="#7a4a00">
        <path d="M-10 70 C 30 40, 70 40, 110 70 C 150 100, 190 100, 230 70 L 230 150 L -10 150 Z" />
      </g>
    </svg>
  )
}

function BadgeCircle({ text, tone }: { text: string; tone: "blue" | "orange" }) {
  const bg = tone === "blue" ? "#6fb3dd" : "#f4a34a"
  return (
    <div
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-black/70 text-[12px] font-bold leading-none"
      style={{ backgroundColor: bg }}
    >
      {text}
    </div>
  )
}

export function RCDocumentTemplate({ data, side, id }: RCDocumentTemplateProps) {
  const state = data.registrationNumber.substring(0, 2).toUpperCase()
  const regnDate = formatDateDdMmYyyy(data.registrationDate)
  const validity = data.registrationValidity || addYearsDdMmYyyy(data.registrationDate, 15)
  const issueMonthYear = formatMonthYear(data.registrationDate)
  const [templateStatus, setTemplateStatus] = useState<"unknown" | "ok" | "missing">("unknown")
  const [templateErrorCount, setTemplateErrorCount] = useState(0)
  const [loadedSideTemplateUrl, setLoadedSideTemplateUrl] = useState<string | null>(null)
  const [loadedCombinedTemplate, setLoadedCombinedTemplate] = useState<{ url: string; w: number; h: number } | null>(null)
  const qr = useMemo(() => {
    const payload = `${data.registrationNumber}|${data.ownerName}|${data.chassisNumber}`
    const auto = QRCode.create(payload, { errorCorrectionLevel: "M" })
    if (auto.version >= MIN_QR_VERSION) return auto
    return QRCode.create(payload, { errorCorrectionLevel: "M", version: MIN_QR_VERSION })
  }, [data.registrationNumber, data.ownerName, data.chassisNumber])

  const qrRender = useMemo(() => {
    const quietZone = 0
    const totalModules = qr.modules.size + quietZone * 2
    const targetPx = 152
    const modulePx = Math.max(2, Math.floor(targetPx / totalModules))
    const pixelSize = totalModules * modulePx
    return { quietZone, totalModules, pixelSize }
  }, [qr.modules.size])

  const templateCandidates = useMemo(() => {
    return [...SIDE_TEMPLATE_CANDIDATES[side], ...COMBINED_TEMPLATE_CANDIDATES]
  }, [side])

  const templateBackgroundStyle: CSSProperties = useMemo(() => {
    if (loadedSideTemplateUrl) {
      return {
        backgroundImage: `url(${loadedSideTemplateUrl})`,
        backgroundSize: "100% 100%",
        backgroundPosition: "0 0",
        backgroundRepeat: "no-repeat",
      }
    }

    if (loadedCombinedTemplate) {
      const crop = COMBINED_TEMPLATE_CROP[side]
      const cropPx = {
        x: loadedCombinedTemplate.w * crop.x,
        y: loadedCombinedTemplate.h * crop.y,
        w: loadedCombinedTemplate.w * crop.w,
        h: loadedCombinedTemplate.h * crop.h,
      }
      const scale = CARD_WIDTH_PX / cropPx.w
      const bgW = loadedCombinedTemplate.w * scale
      const bgH = loadedCombinedTemplate.h * scale
      const posX = -cropPx.x * scale
      const posY = -cropPx.y * scale
      return {
        backgroundImage: `url(${loadedCombinedTemplate.url})`,
        backgroundSize: `${Math.round(bgW)}px ${Math.round(bgH)}px`,
        backgroundPosition: `${Math.round(posX)}px ${Math.round(posY)}px`,
        backgroundRepeat: "no-repeat",
      }
    }

    return {
      backgroundImage: "linear-gradient(135deg, #e9fbff 0%, #dff4ff 45%, #e8f7ff 100%)",
      backgroundSize: "100% 100%",
      backgroundPosition: "0 0",
      backgroundRepeat: "no-repeat",
    }
  }, [loadedCombinedTemplate, loadedSideTemplateUrl, side])

  const handleTemplateLoad = (url: string, naturalW?: number, naturalH?: number) => {
    setTemplateStatus("ok")
    if ((SIDE_TEMPLATE_CANDIDATES[side] as readonly string[]).includes(url)) {
      setLoadedSideTemplateUrl((current) => current ?? url)
      return
    }
    if ((COMBINED_TEMPLATE_CANDIDATES as readonly string[]).includes(url) && naturalW && naturalH) {
      setLoadedCombinedTemplate((current) => current ?? { url, w: naturalW, h: naturalH })
    }
  }

  const handleTemplateError = () => {
    setTemplateErrorCount((prev) => {
      const next = prev + 1
      if (next >= templateCandidates.length) {
        setTemplateStatus((current) => (current === "ok" ? "ok" : "missing"))
      }
      return next
    })
  }

  if (side === "front") {
    const s = CARD_WIDTH_PX / 640
    const sx = CARD_WIDTH_PX / 640
    const sy = CARD_HEIGHT_PX / 404
    const x = (n: number) => `${Math.round(n * sx)}px`
    const y = (n: number) => `${Math.round(n * sy)}px`
    const field = (left: number, top: number, width: number) => ({
      position: "absolute" as const,
      left: x(left),
      top: y(top),
      width: x(width),
    })

    return (
      <div
        id={id ?? "rc-front"}
        className="relative overflow-hidden bg-white text-black"
        style={{
          width: `${CARD_WIDTH_PX}px`,
          height: `${CARD_HEIGHT_PX}px`,
          flex: "0 0 auto",
          borderRadius: "18px",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          className="absolute inset-0"
          style={templateBackgroundStyle}
        />
        {/* Preload for html2canvas */}
        {templateCandidates.map((candidateUrl) => (
          <img
            key={candidateUrl}
            src={candidateUrl}
            alt=""
            className="absolute h-0 w-0 opacity-0"
            crossOrigin="anonymous"
            onLoad={(e) =>
              handleTemplateLoad(candidateUrl, (e.currentTarget as HTMLImageElement).naturalWidth, (e.currentTarget as HTMLImageElement).naturalHeight)
            }
            onError={handleTemplateError}
          />
        ))}

        {templateStatus === "missing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-center text-[12px] font-bold">
            <div>
              Template image not found.
              <div className="mt-1 font-normal">
                Add `public/rc-template/front.jpg` + `public/rc-template/back.jpg`
                <br />
                or add the combined image as `public/rc-template/template.jpg`.
              </div>
            </div>
          </div>
        )}

        {/* Header (positioned to the exact template) */}
        <div
          style={{
            position: "absolute",
            left: x(80),
            top: y(10),
            width: x(480),
            lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          <div style={{ display: "inline-block", textAlign: "left" }}>
            <div style={{ fontSize: x(17), fontWeight: 800, fontFamily: HEADER_FONT_FAMILY }}>
              Indian Union Vehicle Registration Certificate
            </div>
            <div style={{ fontSize: x(12), fontWeight: 700, fontFamily: HEADER_FONT_FAMILY }}>
              Issued by Government of Tamil Nadu
            </div>
          </div>
        </div>

        {/* Text inside the pre-printed circles */}
        <div
          className="font-bold"
          style={{
            position: "absolute",
            left: x(CIRCLE_TEXT_POSITIONS.front.nt.left),
            top: y(CIRCLE_TEXT_POSITIONS.front.nt.top),
            width: x(CIRCLE_TEXT_POSITIONS.front.nt.size),
            height: y(CIRCLE_TEXT_POSITIONS.front.nt.size),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: x(10),
            lineHeight: 1,
          }}
        >
          NT
        </div>
        <div
          className="font-bold"
          style={{
            position: "absolute",
            left: x(CIRCLE_TEXT_POSITIONS.front.state.left),
            top: y(CIRCLE_TEXT_POSITIONS.front.state.top),
            width: x(CIRCLE_TEXT_POSITIONS.front.state.size),
            height: y(CIRCLE_TEXT_POSITIONS.front.state.size),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: x(10),
            lineHeight: 1,
          }}
        >
          {state || "TN"}
        </div>

        {/* Front fields */}
        <div className="text-black" style={field(260, 94, 120)}>
          <div style={{ fontSize: x(10) }}>Regn. No</div>
          <div className="font-bold" style={{ fontSize: x(14) }}>
            {data.registrationNumber.toUpperCase()}
          </div>
        </div>
        <div className="text-black" style={field(395, 94, 110)}>
          <div style={{ fontSize: x(10) }}>Date of Regn.</div>
          <div className="font-bold" style={{ fontSize: x(12) }}>
            {regnDate}
          </div>
        </div>
        <div className="text-black" style={field(515, 94, 115)}>
          <div style={{ fontSize: x(10) }}>Regn. Validity</div>
          <div className="font-bold" style={{ fontSize: x(12) }}>
            {validity}
          </div>
        </div>

        <div className="text-black" style={field(260, 143, 260)}>
          <div style={{ fontSize: x(10) }}>Chassis Number</div>
          <div className="font-bold" style={{ fontSize: x(13) }}>
            {data.chassisNumber.toUpperCase()}
          </div>
        </div>

        <div className="text-black" style={field(520, 141, 120)}>
          <div style={{ fontSize: x(10) }}>Owner</div>
          <div style={{ fontSize: x(10) }}>Serial</div>
        </div>
        <div className="font-bold" style={{ position: "absolute", right: x(22), top: y(149), fontSize: x(18) }}>
          1
        </div>

        <div className="text-black" style={field(260, 186, 240)}>
          <div style={{ fontSize: x(10) }}>Engine / Motor Number</div>
          <div className="font-bold" style={{ fontSize: x(13) }}>
            {data.engineNumber.toUpperCase()}
          </div>
        </div>

        <div className="text-black" style={field(260, 229, 260)}>
          <div style={{ fontSize: x(10) }}>Owner Name</div>
          <div className="font-bold" style={{ fontSize: x(16) }}>
            {data.ownerName.toUpperCase()}
          </div>
        </div>

        <div className="text-black" style={field(260, 265, 340)}>
          <div style={{ fontSize: x(10) }}>
            Son / Daughter / Wife of&nbsp;&nbsp;&nbsp;&nbsp; <span>(In case of Individual Owner)</span>
          </div>
        </div>

        <div className="text-black" style={field(260, 290, 360)}>
          <div style={{ fontSize: x(10) }}>Address</div>
          <div className="font-bold" style={{ fontSize: x(11), lineHeight: 1.2 }}>
            {data.address}
          </div>
        </div>

        <div className="text-black" style={field(48, 238, 160)}>
          <div style={{ fontSize: x(10) }}>Fuel</div>
          <div className="font-bold" style={{ fontSize: x(11) }}>
            {(data.fuelType || "").toUpperCase()}
          </div>
        </div>

        <div className="text-black" style={field(48, 290, 170)}>
          <div style={{ fontSize: x(10) }}>Emission Norms</div>
          <div className="font-bold" style={{ fontSize: x(11) }}>
            {(data.emissionNorms || "BHARAT STAGE VI").toUpperCase()}
          </div>
        </div>

        <div
          className="font-bold"
          style={{
            position: "absolute",
            right: x(-34),
            top: y(151),
            transformOrigin: "top right",
            transform: "rotate(-90deg)",
            whiteSpace: "nowrap",
            fontSize: x(10),
          }}
        >
          Card Issue Date&nbsp; {issueMonthYear}
        </div>
      </div>
    )
  }

  // Back Side
  const sx = CARD_WIDTH_PX / 640
  const sy = CARD_HEIGHT_PX / 404
  const x = (n: number) => `${Math.round(n * sx)}px`
  const y = (n: number) => `${Math.round(n * sy)}px`
  const field = (left: number, top: number, width: number) => ({
    position: "absolute" as const,
    left: x(left),
    top: y(top),
    width: x(width),
  })

  return (
    <div
      id={id ?? "rc-back"}
      className="relative overflow-hidden bg-white text-black"
      style={{
        width: `${CARD_WIDTH_PX}px`,
        height: `${CARD_HEIGHT_PX}px`,
        flex: "0 0 auto",
        borderRadius: "18px",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        className="absolute inset-0"
        style={templateBackgroundStyle}
      />
      {/* Preload for html2canvas */}
      {templateCandidates.map((candidateUrl) => (
        <img
          key={candidateUrl}
          src={candidateUrl}
          alt=""
          className="absolute h-0 w-0 opacity-0"
          crossOrigin="anonymous"
          onLoad={(e) =>
            handleTemplateLoad(candidateUrl, (e.currentTarget as HTMLImageElement).naturalWidth, (e.currentTarget as HTMLImageElement).naturalHeight)
          }
          onError={handleTemplateError}
        />
      ))}

      {templateStatus === "missing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-center text-[12px] font-bold">
          <div>
            Template image not found.
            <div className="mt-1 font-normal">
              Add `public/rc-template/front.jpg` + `public/rc-template/back.jpg`
              <br />
              or add the combined image as `public/rc-template/template.jpg`.
            </div>
          </div>
        </div>
      )}

      {/* Header overlay */}
      <div
        className="font-bold"
        style={{
          position: "absolute",
          left: x(CIRCLE_TEXT_POSITIONS.back.nt.left),
          top: y(CIRCLE_TEXT_POSITIONS.back.nt.top),
          width: x(CIRCLE_TEXT_POSITIONS.back.nt.size),
          height: y(CIRCLE_TEXT_POSITIONS.back.nt.size),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: x(10),
          lineHeight: 1,
        }}
      >
        NT
      </div>
      <div
        className="font-bold"
        style={{
          position: "absolute",
          left: x(CIRCLE_TEXT_POSITIONS.back.state.left),
          top: y(CIRCLE_TEXT_POSITIONS.back.state.top),
          width: x(CIRCLE_TEXT_POSITIONS.back.state.size),
          height: y(CIRCLE_TEXT_POSITIONS.back.state.size),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: x(10),
          lineHeight: 1,
        }}
      >
        {state || "TN"}
      </div>
      <div
        className="absolute left-0 right-0 text-center"
        style={{ top: y(16), fontSize: x(12), fontFamily: HEADER_FONT_FAMILY, fontWeight: 800 }}
      >
        Vehicle Class:&nbsp; {data.vehicleClass}
      </div>

      <div className="text-black" style={field(32, 86, 170)}>
        <div style={{ fontSize: x(10) }}>Regn. Number</div>
        <div className="font-bold" style={{ fontSize: x(14) }}>
          {data.registrationNumber.toUpperCase()}
        </div>
      </div>

      <div style={{ position: "absolute", left: x(32), top: y(118), width: x(160), height: x(160) }}>
        <div className="flex h-full w-full items-center justify-center">
          <svg
            viewBox={`0 0 ${qrRender.totalModules} ${qrRender.totalModules}`}
            style={{ width: `${qrRender.pixelSize}px`, height: `${qrRender.pixelSize}px` }}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            {Array.from({ length: qr.modules.size }, (_, row) =>
              Array.from({ length: qr.modules.size }, (_, col) => {
                const on = qr.modules.get(col, row)
                return on ? (
                  <rect
                    key={`${col}-${row}`}
                    x={col + qrRender.quietZone}
                    y={row + qrRender.quietZone}
                    width="1"
                    height="1"
                    fill="#000"
                  />
                ) : null
              }),
            )}
          </svg>
        </div>
      </div>

      <div className="text-black" style={field(32, 292, 180)}>
        <div style={{ fontSize: x(10) }}>Month - Year of Mfg.</div>
        <div className="font-bold" style={{ fontSize: x(12) }}>
          {formatMonthYear(data.manufacturingDate || data.registrationDate)}
        </div>
      </div>

      <div className="text-black" style={field(32, 330, 180)}>
        <div style={{ fontSize: x(10) }}>No of Cylinders :</div>
        <div className="font-bold" style={{ fontSize: x(12) }}>
          {(data.cylinders || "4").toString()}
        </div>
      </div>

      <div className="text-black" style={field(250, 86, 300)}>
        <div style={{ fontSize: x(10) }}>Maker's Name</div>
        <div className="font-bold" style={{ fontSize: x(12) }}>
          {data.maker.toUpperCase()}
        </div>
      </div>
      <div className="text-black" style={field(250, 126, 300)}>
        <div style={{ fontSize: x(10) }}>Model Name</div>
        <div className="font-bold" style={{ fontSize: x(12) }}>
          {data.model.toUpperCase()}
        </div>
      </div>
      <div className="text-black" style={field(250, 166, 300)}>
        <div style={{ fontSize: x(10) }}>Color</div>
        <div className="font-bold" style={{ fontSize: x(12) }}>
          {(data.color || "PRME SPLENDID SILVER").toUpperCase()}
        </div>
      </div>
      <div className="text-black" style={field(250, 206, 300)}>
        <div style={{ fontSize: x(10) }}>Body Type</div>
        <div className="font-bold" style={{ fontSize: x(12) }}>
          {(data.bodyType || "HATCHBACK").toUpperCase()}
        </div>
      </div>

      <div className="text-black" style={field(250, 248, 150)}>
        <div style={{ fontSize: x(10) }}>Seating (in all) Capacity</div>
        <div className="font-bold" style={{ fontSize: x(12) }}>
          {data.seatingCapacity || "5"}
        </div>
      </div>
      <div className="text-black" style={field(418, 248, 160)}>
        <div style={{ fontSize: x(10) }}>Unladen Weight (Kg)</div>
        <div className="font-bold" style={{ fontSize: x(12) }}>
          {data.unladenWeight || "930"}
        </div>
      </div>

      <div className="text-black" style={field(250, 292, 150)}>
        <div style={{ fontSize: x(10) }}>Cubic Cap. / Horse Power (BHP/Kw)</div>
        <div className="font-bold" style={{ fontSize: x(12) }}>
          {data.cubicCapacity || "1197.00"}
        </div>
      </div>
      <div className="text-black font-bold" style={field(405, 314, 60)}>
        <div style={{ fontSize: x(12) }}>{data.horsePower || "82.6"}</div>
      </div>
      <div className="text-black" style={field(480, 292, 140)}>
        <div style={{ fontSize: x(10) }}>Wheel Base(mm)</div>
        <div className="font-bold" style={{ fontSize: x(12) }}>
          {data.wheelBase || "2520"}
        </div>
      </div>

      <div className="text-black" style={field(250, 350, 180)}>
        <div style={{ fontSize: x(10) }}>Financier</div>
        <div className="font-bold" style={{ fontSize: x(10) }}>
          {(data.financier || "KOTAK MAHINDRA PRIME LTD").toUpperCase()}
        </div>
      </div>
      <div className="text-black" style={field(440, 350, 190)}>
        <div style={{ fontSize: x(10) }}>Registration Authority</div>
        <div className="font-bold" style={{ fontSize: x(10) }}>
          {(data.registrationAuthority || "COIMBATORE (NORTH) RTO, Tamil Nadu").toUpperCase()}
        </div>
      </div>

      <div
        className="font-bold"
        style={{
          position: "absolute",
          right: x(-30),
          top: y(140),
          transformOrigin: "top right",
          transform: "rotate(-90deg)",
          whiteSpace: "nowrap",
          fontSize: x(10),
        }}
      >
        Form : 23A
      </div>
    </div>
  )
}

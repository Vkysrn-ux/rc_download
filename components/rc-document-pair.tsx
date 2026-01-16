"use client"

import { useEffect, useRef, useState } from "react"
import { RCDocumentTemplate } from "@/components/rc-document-template"

const CARD_WIDTH_PX = 640
const CARD_GAP_PX = 12
const CARD_HEIGHT_PX = 404

type RCDocumentPairPreviewProps = {
  data: any
  frontId?: string
  backId?: string
  className?: string
}

export function RCDocumentPairPreview({ data, frontId, backId, className }: RCDocumentPairPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const totalWidth = CARD_WIDTH_PX * 2 + CARD_GAP_PX

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateScale = () => {
      const width = element.clientWidth
      if (!width) return
      const nextScale = Math.min(1, width / totalWidth)
      setScale((prev) => (Math.abs(prev - nextScale) < 0.01 ? prev : nextScale))
    }

    updateScale()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(updateScale)
    observer.observe(element)
    return () => observer.disconnect()
  }, [totalWidth])

  const scaledWidth = Math.round(totalWidth * scale)
  const scaledHeight = Math.round(CARD_HEIGHT_PX * scale)

  return (
    <div ref={containerRef} className={`w-full overflow-hidden ${className ?? ""}`.trim()}>
      <div className="mx-auto overflow-hidden" style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}>
        <div
          className="flex items-start"
          style={{
            gap: `${CARD_GAP_PX}px`,
            width: `${totalWidth}px`,
            height: `${CARD_HEIGHT_PX}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <RCDocumentTemplate data={data} side="front" id={frontId} />
          <RCDocumentTemplate data={data} side="back" id={backId} />
        </div>
      </div>
    </div>
  )
}

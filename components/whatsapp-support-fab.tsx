import Link from "next/link"

function sanitizeWhatsAppNumber(value: string) {
  return (value || "").replace(/[^\d]/g, "")
}

export default function WhatsAppSupportFab() {
  const waNumber = sanitizeWhatsAppNumber(process.env.NEXT_PUBLIC_HELPDESK_WHATSAPP_NUMBER || "919677979393")
  const waText = process.env.NEXT_PUBLIC_HELPDESK_WHATSAPP_TEXT || "Hi, I need help with RC Download."
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}` : "/helpdesk"

  const commonClassName =
    "fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"

  const icon = (
    <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden="true">
      <path d="M16.006 3.183c-7.117 0-12.91 5.792-12.91 12.909 0 2.274.594 4.494 1.72 6.456L3 29l6.617-1.736a12.86 12.86 0 0 0 6.389 1.652h.006c7.117 0 12.91-5.792 12.91-12.91 0-3.449-1.346-6.686-3.786-9.126A12.833 12.833 0 0 0 16.006 3.183zm7.47 18.14c-.31.874-1.814 1.673-2.499 1.777-.636.097-1.43.138-2.31-.146-.533-.173-1.216-.396-2.1-.776-3.695-1.594-6.11-5.48-6.296-5.732-.182-.252-1.501-2.0-1.501-3.817 0-1.817.952-2.71 1.288-3.078.336-.368.733-.46.977-.46.244 0 .489.002.703.013.226.01.526-.086.824.63.31.757 1.056 2.616 1.15 2.806.094.19.157.41.031.662-.126.252-.189.409-.373.63-.184.221-.387.494-.553.662-.184.19-.376.4-.162.779.214.378.953 1.571 2.046 2.544 1.407 1.255 2.594 1.644 2.972 1.834.378.19.599.158.82-.095.221-.252.945-1.1 1.198-1.478.252-.378.506-.316.852-.19.347.126 2.193 1.034 2.57 1.22.378.186.63.284.725.44.094.158.094.914-.215 1.788z" />
    </svg>
  )

  if (waUrl.startsWith("http")) {
    return (
      <a
        href={waUrl}
        className={commonClassName}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp support"
        title="WhatsApp support"
      >
        {icon}
      </a>
    )
  }

  return (
    <Link href={waUrl} className={commonClassName} aria-label="WhatsApp support" title="WhatsApp support">
      {icon}
    </Link>
  )
}


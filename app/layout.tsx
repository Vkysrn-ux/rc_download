import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Open_Sans } from "next/font/google"
import Script from "next/script"
import { AuthProvider } from "@/lib/auth-context"
import WhatsAppSupportFab from "@/components/whatsapp-support-fab"
import "./globals.css"

export const metadata: Metadata = {
  title: "VehicleRCDownload.com - Vehicle RC & Official Documents",
  description: "Download your vehicle RC and other official documents instantly. Fast, secure, and affordable.",
}

const openSans = Open_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${openSans.variable} font-sans antialiased`}>
        <AuthProvider>{children}</AuthProvider>
        <WhatsAppSupportFab />
        {process.env.NEXT_PUBLIC_GA_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-setup" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');`}
            </Script>
          </>
        ) : null}
        <Analytics />
      </body>
    </html>
  )
}

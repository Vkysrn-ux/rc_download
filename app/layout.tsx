import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Open_Sans } from "next/font/google"
import { AuthProvider } from "@/lib/auth-context"
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
        <Analytics />
      </body>
    </html>
  )
}

import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import GlobalNav from "@/components/global-nav"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Servio - QR Code Ordering System",
  description: "Transform your restaurant with digital menus and seamless QR code ordering",
  keywords: "restaurant, QR code, digital menu, ordering system, POS",
  authors: [{ name: "Servio Team" }],
  viewport: "width=device-width, initial-scale=1",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GlobalNav />
        {children}
      </body>
    </html>
  )
}

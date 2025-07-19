import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import GlobalNav from "@/components/global-nav"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Servio - QR Code Ordering Made Simple",
  description: "Streamline your business operations with contactless QR code ordering. Customers scan, order, and pay - all from their phones.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <GlobalNav />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

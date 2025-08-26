import type { Metadata } from 'next'
import '@/styles/globals.css'
import NavBar from '@/components/NavBar'
import { AuthProvider } from './authenticated-client-provider'

export const metadata: Metadata = {
  title: 'Servio - QR Code Ordering Made Simple',
  description: 'Streamline your business operations with contactless QR code ordering.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <NavBar />
          <main>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}

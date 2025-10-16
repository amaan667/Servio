import type { Metadata } from "next";
// Railway deployment trigger - premium gates removed
import { Inter } from "next/font/google";
import "./globals.css";
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasSupabaseAuthCookies } from '@/lib/auth/utils';
import AuthProvider from '@/app/auth/AuthProvider';
import Providers from "./providers";
import ThemeToggleFloat from "@/components/ThemeToggleFloat";
import ConditionalHeader from "@/components/ConditionalHeader";
import ConditionalBottomNav from "@/components/ConditionalBottomNav";
import { ErrorBoundary } from "@/components/error-boundary";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Servio - QR Code Ordering Made Simple",
  description:
    "Streamline your business operations with contactless QR code ordering. Customers scan, order, and pay - all from their phones.",
  manifest: "/manifest.json",
  themeColor: "#7c3aed",
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Servio',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Servio',
    title: 'Servio - QR Code Ordering Made Simple',
    description: 'Streamline your business operations with contactless QR code ordering',
  },
  twitter: {
    card: 'summary',
    title: 'Servio - QR Code Ordering Made Simple',
    description: 'Streamline your business operations with contactless QR code ordering',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/images/icon-192.png',
  },
};

// Viewport is now defined in metadata above

// Force dynamic rendering to prevent static generation errors with cookies
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the actual session from the server efficiently using secure method
  let session = null;
  try {
    const supabase = await createServerSupabase();
    const { data: { session: serverSession } } = await supabase.auth.getSession();
    session = serverSession;
  } catch (error) {
    // Silent error handling - session will remain null
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorBoundary>
          <AuthProvider initialSession={session}>
            <Providers>
              <ConditionalHeader />
              {children}
              <ThemeToggleFloat />
              <ConditionalBottomNav />
            </Providers>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
// Deployment trigger Thu Oct  9 15:53:11 BST 2025

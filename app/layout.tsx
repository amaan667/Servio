import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasSupabaseAuthCookies } from '@/lib/auth/utils';
import AuthProvider from '@/app/auth/AuthProvider';
import Providers from "./providers";
import ThemeToggleFloat from "@/components/ThemeToggleFloat";
import ConditionalHeader from "@/components/ConditionalHeader";
import { ErrorBoundary } from "@/components/error-boundary";
// import DashboardDebugPanel from "@/components/dashboard-debug-panel";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Servio - QR Code Ordering Made Simple",
  description:
    "Streamline your business operations with contactless QR code ordering. Customers scan, order, and pay - all from their phones.",
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
};

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
    // Silent error handling
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
              {/* <DashboardDebugPanel /> */}
            </Providers>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

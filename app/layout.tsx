import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasSupabaseAuthCookies } from '@/lib/auth/utils';
import AuthProvider from '@/app/auth/AuthProvider';
import Providers from "./providers";
import ThemeToggleFloat from "@/components/ThemeToggleFloat";
import AppHeader from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/error-boundary";
// import DashboardDebugPanel from "@/components/dashboard-debug-panel";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Servio - QR Code Ordering Made Simple",
  description:
    "Streamline your business operations with contactless QR code ordering. Customers scan, order, and pay - all from their phones.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Always start with no session to prevent automatic sign-in
  // Users must explicitly sign in through the sign-in page
  const initialSession = null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorBoundary>
          <AuthProvider initialSession={initialSession}>
            <Providers>
              <AppHeader />
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

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseAuthCookies } from '@/lib/auth/utils';
import AuthProvider from '@/app/auth/AuthProvider';
import Providers from "./providers";
import ThemeToggleFloat from "@/components/ThemeToggleFloat";
import AppHeader from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/error-boundary";
import DashboardDebugPanel from "@/components/dashboard-debug-panel";

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
  let initialSession = null;
  const cookieStore = await cookies();
  const names = cookieStore.getAll().map((c) => c.name);
  if (hasSupabaseAuthCookies(names)) {
    const supabase = await createServerSupabase();
    // Safe: only called when auth cookies exist, avoids refresh_token_not_found
    const { data: { session } } = await supabase.auth.getSession();
    initialSession = session ?? null;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorBoundary>
          <AuthProvider initialSession={initialSession}>
            <Providers>
              <AppHeader />
              {children}
              <ThemeToggleFloat />
              <DashboardDebugPanel />
            </Providers>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

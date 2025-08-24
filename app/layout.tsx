import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import ThemeToggleFloat from "@/components/ThemeToggleFloat";
import AppHeader from "@/components/AppHeader";
import AuthWrapper from "@/components/AuthWrapper";
import { ErrorBoundary } from "@/components/error-boundary";
import { SupabaseConfigCheck } from "@/components/supabase-config-check";
import HealthCheck from "@/components/HealthCheck";
import SupabaseConfigError from "@/components/SupabaseConfigError";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Servio - QR Code Ordering Made Simple",
  description:
    "Streamline your business operations with contactless QR code ordering. Customers scan, order, and pay - all from their phones.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorBoundary>
          <Providers>
            <SupabaseConfigCheck />
            <SupabaseConfigError />
            <AppHeader />
            {children}
            <ThemeToggleFloat />
            <HealthCheck />
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}

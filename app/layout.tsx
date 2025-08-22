import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import ThemeToggleFloat from "@/components/ThemeToggleFloat";
import AppHeader from "@/components/AppHeader";
import AuthWrapper from "@/components/AuthWrapper";
import { ErrorBoundary } from "@/components/error-boundary";
import { setupStartupErrorHandlers, logStartupInfo, validateEnvironmentVariables } from "@/lib/startup-error-handler";

// Use system fonts to avoid Google Fonts network dependency
const fontClass = "font-sans";

// Set up error handlers and validation as early as possible
if (typeof window === 'undefined') {
  // Server-side initialization
  try {
    console.log('🚀 Server-side startup initialization...');
    setupStartupErrorHandlers();
    logStartupInfo();
    validateEnvironmentVariables();
    console.log('✅ Server-side initialization completed successfully');
  } catch (error) {
    console.error('💥 Server-side initialization failed:', error);
    // Don't throw here to allow the error boundary to handle it gracefully
  }
}

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
      <body className={fontClass}>
        <ErrorBoundary>
          <Providers>
            <AppHeader />
            {children}
            <ThemeToggleFloat />
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}

// Initialize error suppression FIRST, before any other imports
import { initErrorSuppression } from "@/lib/error-suppression";
initErrorSuppression();

import type { Metadata } from "next";
// Railway deployment trigger - premium gates removed
import { Inter } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase";
import AuthProvider from "@/app/auth/AuthProvider";
import Providers from "./providers";
import ThemeToggleFloat from "@/components/ThemeToggleFloat";
import ConditionalHeader from "@/components/ConditionalHeader";
import ConditionalBottomNav from "@/components/ConditionalBottomNav";
import { ErrorBoundary } from "@/components/error-boundary";
import { Analytics } from "@/components/Analytics";
import { WebVitals } from "./web-vitals";

// Optimized font loading with display swap and preload
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
  adjustFontFallback: true,
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://servio.app"),
  title: {
    default: "Servio - QR Code Ordering Made Simple",
    template: "%s | Servio",
  },
  description:
    "Complete POS and QR ordering platform for restaurants, cafes, food trucks, and market stalls. Manage orders, payments, inventory, and kitchen operations in one system. 14-day free trial.",
  keywords: [
    "QR code ordering",
    "food business POS",
    "cafe POS system",
    "food truck ordering",
    "contactless ordering",
    "digital menu",
    "QR menu",
    "hospitality technology",
    "mobile ordering",
    "kitchen display system",
    "inventory management",
  ],
  authors: [{ name: "Servio" }],
  creator: "Servio",
  publisher: "Servio",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Servio",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://servio.app",
    siteName: "Servio",
    title: "Servio - Complete POS & QR Ordering for Food Businesses",
    description:
      "All-in-one platform for restaurants, cafes, food trucks, and stalls. QR ordering, POS, payments, and kitchen management.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Servio - QR Code Ordering Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Servio - Complete POS & QR Ordering for Food Businesses",
    description: "All-in-one platform for restaurants, cafes, food trucks, and stalls",
    images: ["/images/og-image.png"],
    creator: "@servio_app",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/images/icon-192.png",
  },
};

// Viewport configuration (moved out of metadata for Next.js 15+)
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#7c3aed",
};

// Force dynamic rendering to prevent static generation errors with cookies
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Get the actual session from the server efficiently using secure method
  let session = null;
  try {
    const cookieStore = await cookies();

    // Check if auth cookies exist before attempting to get session
    // This prevents unnecessary API calls for logged-out users
    const hasAuthCookies = cookieStore
      .getAll()
      .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));

    if (hasAuthCookies) {
      const supabase = await createServerSupabase();

      // Wrap getSession in try-catch to handle refresh token errors gracefully
      try {
        const {
          data: { session: serverSession },
        } = await supabase.auth.getSession();
        session = serverSession;
      } catch {
        // Silently catch refresh token errors - no logging needed
      }
    }
  } catch {
    // Silent error handling - session will remain null
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* DNS Prefetch & Preconnect for faster third-party connections */}
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        {/* Supabase preconnect */}
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL}
          crossOrigin="anonymous"
        />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <AuthProvider initialSession={session}>
            <Providers>
              <ConditionalHeader />
              {children}
              <ThemeToggleFloat />
              <ConditionalBottomNav />
              <Analytics />
              <WebVitals />
            </Providers>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
// Deployment trigger - PROPER FIX: Re-enabled autoRefreshToken - Wed Oct 22 2025

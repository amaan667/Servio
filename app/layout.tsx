// Initialize error suppression FIRST, before any other imports
import { initErrorSuppression } from "@/lib/error-suppression";
initErrorSuppression();

import type { Metadata } from "next";
// Railway deployment trigger - premium gates removed
import { Inter } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { createServerSupabaseReadOnly } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import AuthProvider from "@/app/auth/AuthProvider";
import Providers from "./providers";
import ConditionalHeader from "@/components/ConditionalHeader";
import ConditionalBottomNav from "@/components/ConditionalBottomNav";
import { ScrollToTop } from "@/components/scroll-to-top";
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
  // Reduce font variants to improve loading
  weight: ["400", "500", "600", "700"],
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
    startupImage: [
      {
        url: "/placeholder-logo.png",
        media: "(prefers-color-scheme: light)",
      },
    ],
  },
  applicationName: "Servio",
  other: {
    "mobile-web-app-capable": "yes",
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
        url: "/placeholder-logo.png",
        width: 512,
        height: 512,
        alt: "Servio - QR Code Ordering Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Servio - Complete POS & QR Ordering for Food Businesses",
    description: "All-in-one platform for restaurants, cafes, food trucks, and stalls",
    images: ["/placeholder-logo.png"],
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
    icon: [{ url: "/assets/servio-s-logo.png", sizes: "any", type: "image/png" }],
    shortcut: "/assets/servio-s-logo.png",
    apple: "/assets/servio-s-logo.png",
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
    const allCookies = cookieStore.getAll();

    logger.info("[ROOT LAYOUT] 🚀 Root layout rendering", {
      totalCookies: allCookies.length,
      cookieNames: allCookies.map((c) => c.name).join(", "),
    });

    // Check if auth cookies exist before attempting to get session
    // This prevents unnecessary API calls for logged-out users
    const hasAuthCookies = allCookies.some(
      (cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")
    );

    if (hasAuthCookies) {
      // Use read-only client in layout to prevent cookie modification errors
      const supabase = await createServerSupabaseReadOnly();

      // Use getSession() to get the full session with tokens
      // Add timeout to prevent hanging
      try {
        const {
          data: { session: authSession },
          error,
        } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null }; error: null }>((resolve) => 
            setTimeout(() => resolve({ data: { session: null }, error: null }), 2000)
          ),
        ]);

        logger.info("[ROOT LAYOUT] 📋 getSession() result", {
          hasSession: !!authSession,
          hasUser: !!authSession?.user,
          userId: authSession?.user?.id,
          email: authSession?.user?.email,
          hasAccessToken: !!authSession?.access_token,
          accessTokenPreview: authSession?.access_token?.substring(0, 20),
          hasError: !!error,
          errorMsg: error?.message,
        });

        if (!error && authSession) {
          // Use the actual session from Supabase with real tokens
          session = authSession;
          logger.info("[ROOT LAYOUT] ✅ Session obtained from server", {
            userId: authSession.user?.id,
            hasAccessToken: !!session.access_token,
            accessTokenLength: session.access_token?.length,
          });
        } else {
          logger.warn("[ROOT LAYOUT] ⚠️ No session or error from getSession()", {
            error: error?.message,
            hadCookies: hasAuthCookies,
            cookieCount: allCookies.filter((c) => c.name.includes("auth-token")).length,
          });
        }
      } catch (err) {
        logger.error("[ROOT LAYOUT] ❌ Error calling getSession()", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      // Block handled
    }
  } catch (err) {
    logger.error("[ROOT LAYOUT] ❌ Error in root layout", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info("[ROOT LAYOUT] 🎯 Final session state", {
    hasSession: !!session,
    hasUser: !!session?.user,
    hasAccessToken: !!session?.access_token,
    userId: session?.user?.id,
  });

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
              <ConditionalBottomNav />
              <ScrollToTop />
              <Analytics />
              <WebVitals />
            </Providers>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
// Deployment trigger - Auth fix + cache bust - Wed Oct 22 2025 v2

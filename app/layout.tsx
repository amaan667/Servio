// Initialize error suppression FIRST, before any other imports
import { initErrorSuppression } from "@/lib/error-suppression";
initErrorSuppression();

import type { Metadata } from "next";
import * as Sentry from "@sentry/nextjs";
// Railway deployment trigger - premium gates removed
import { Inter } from "next/font/google";
import "./globals.css";
import { createServerSupabaseReadOnly } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
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

export function generateMetadata(): Metadata {
  return {
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
      ...Sentry.getTraceData(),
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
}

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
    // Resolve auth for first paint so mobile/desktop render same (no flash).
    // Try getSession() first (fast from cookies); then validate with getUser() with longer timeout for mobile.
    const supabase = await createServerSupabaseReadOnly();

    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData?.session?.user ?? null;

    try {
      const {
        data: { user: authUser },
        error,
      } = await Promise.race([
        supabase.auth.getUser(),
        new Promise<{ data: { user: null }; error: null }>((resolve) =>
          setTimeout(() => resolve({ data: { user: null }, error: null }), 3500)
        ),
      ]);

      const user = !error && authUser ? authUser : sessionUser;
      if (user) {
        // Fetch primary venue data to prevent navigation flicker
        let primaryVenueData = null;
        try {
          const [venueResult, staffResult] = await Promise.all([
            supabase
              .from("venues")
              .select("venue_id")
              .eq("owner_user_id", user.id)
              .order("created_at", { ascending: true })
              .limit(1),
            supabase
              .from("user_venue_roles")
              .select("role, venue_id")
              .eq("user_id", user.id)
              .limit(1)
              .single(),
          ]);

          if (
            !venueResult.error &&
            Array.isArray(venueResult.data) &&
            venueResult.data.length > 0 &&
            venueResult.data[0]?.venue_id
          ) {
            primaryVenueData = {
              venueId: venueResult.data[0].venue_id,
              role: "owner",
            };
          } else if (!staffResult.error && staffResult.data?.venue_id && staffResult.data?.role) {
            primaryVenueData = {
              venueId: staffResult.data.venue_id,
              role: staffResult.data.role,
            };
          }
        } catch {
          // Venue fetch failed, continue without venue data
        }

        // Construct session object from authenticated user with venue data
        session = {
          user,
          access_token: "", // Not needed for layout, only user info is required
          refresh_token: "",
          expires_in: 0,
          expires_at: undefined,
          token_type: "bearer",
          // Add venue data to prevent navigation flicker
          primaryVenue: primaryVenueData,
        } as unknown as Session;
      }
    } catch {
      // Silent - layout can continue without session
    }
  } catch (err) {
    // Error handled
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

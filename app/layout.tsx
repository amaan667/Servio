// Initialize error suppression FIRST, before any other imports
import { initErrorSuppression } from "@/lib/error-suppression";
initErrorSuppression();

import type { Metadata } from "next";
import * as Sentry from "@sentry/nextjs";
// Railway deployment trigger - premium gates removed
import { Inter } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
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

  fallback: ["system-ui", "arial"],

  // Reduce font variants to improve loading
  weight: ["400", "500", "600", "700"],

export function generateMetadata(): Metadata {
  return {

    },
    description:
      "Complete POS and QR ordering platform for restaurants, cafes, food trucks, and market stalls. Manage orders, payments, inventory, and kitchen operations in one system. 14-day free trial.",

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

        },
      ],
    },

      ...Sentry.getTraceData(),
    },

    },

      description:
        "All-in-one platform for restaurants, cafes, food trucks, and stalls. QR ordering, POS, payments, and kitchen management.",

        },
      ],
    },

      description: "All-in-one platform for restaurants, cafes, food trucks, and stalls",

    },

        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },

      icon: [{ url: "/assets/servio-s-logo.png", sizes: "any", type: "image/png" }],

    },
  };
}

// Viewport configuration (moved out of metadata for Next.js 15+)
export const viewport = {

};

// Force dynamic rendering to prevent static generation errors with cookies
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Get the actual session from the server efficiently using secure method
  let session = null;
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    // Check if auth cookies exist - try to get session for ALL pages
    // This ensures dashboard pages get auth state immediately, preventing flicker
    const hasAuthCookies = allCookies.some(
      (cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")
    );

    if (hasAuthCookies) {
      // Use read-only client in layout to prevent cookie modification errors
      const supabase = await createServerSupabaseReadOnly();

      // Use getUser() for secure authentication (validates with Supabase Auth server)
      // Add timeout to prevent hanging
      try {
        const {
          data: { user: authUser },
          error,
        } = await Promise.race([
          supabase.auth.getUser(),
          new Promise<{ data: { user: null }; error: null }>((resolve) =>
            setTimeout(() => resolve({ data: { user: null }, error: null }), 1000)
          ),
        ]);

        if (!error && authUser) {
          // Fetch primary venue data to prevent navigation flicker
          let primaryVenueData = null;
          try {
            // Get primary venue for immediate navigation availability
            const [venueResult, staffResult] = await Promise.all([
              supabase
                .from("venues")
                .select("venue_id")
                .eq("owner_user_id", authUser.id)
                .order("created_at", { ascending: true })
                .limit(1),
              supabase
                .from("user_venue_roles")
                .select("role, venue_id")
                .eq("user_id", authUser.id)
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

              };
            } else if (!staffResult.error && staffResult.data?.venue_id && staffResult.data?.role) {
              primaryVenueData = {

              };
            }
          } catch (venueErr) {
            // Venue fetch failed, continue without venue data
          }

          // Construct session object from authenticated user with venue data
          session = {

            access_token: "", // Not needed for layout, only user info is required

            // Add venue data to prevent navigation flicker

          } as unknown as Session;
        }
      } catch (err) {
        // Error handled
      }
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

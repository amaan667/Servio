import { createServerSupabase } from "@/lib/supabase";
import { cookies } from "next/headers";

import { isProduction } from "@/lib/env";
import { success } from "@/lib/api/standard-response";

export async function POST() {
  try {
    const supabase = await createServerSupabase();

    // SECURE: Use getUser() instead of getSession() for authentication check
    // Don't fail if user is not authenticated - still clear cookies
    await supabase.auth.getUser().catch(() => null);

    // Perform the signout
    await supabase.auth.signOut().catch(() => null);

    // Create a response that clears cookies
    const response = success({ signedOut: true });

    // Get the Supabase project ref for dynamic cookie names
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "default";

    // MOBILE FIX: Comprehensive list of auth cookies to clear
    // Includes both old-style and new Supabase SSR cookie names
    const authCookieNames = [
      // Legacy cookie names
      "sb-access-token",
      "sb-refresh-token",
      "supabase.auth.token",
      "supabase-auth-token",
      // New Supabase SSR cookie names (chunked)
      `sb-${projectRef}-auth-token`,
      `sb-${projectRef}-auth-token.0`,
      `sb-${projectRef}-auth-token.1`,
      `sb-${projectRef}-auth-token.2`,
      `sb-${projectRef}-auth-token.3`,
      `sb-${projectRef}-auth-token.4`,
      `sb-${projectRef}-auth-token-code-verifier`,
    ];

    // Clear all auth cookies with mobile-friendly settings
    authCookieNames.forEach((cookieName) => {
      response.cookies.set(cookieName, "", {
        maxAge: 0,
        expires: new Date(0),
        path: "/",
        sameSite: "lax", // MOBILE FIX: Use 'lax' for better mobile compatibility
        secure: isProduction(),
        httpOnly: false, // Must be false for Supabase client to read
      });
    });

    // Also try to clear any cookies from the cookie store that match auth patterns
    try {
      const cookieStore = await cookies();
      const allCookies = cookieStore.getAll();

      allCookies.forEach((cookie) => {
        if (
          cookie.name.includes("sb-") ||
          cookie.name.includes("supabase") ||
          cookie.name.includes("auth")
        ) {
          response.cookies.set(cookie.name, "", {
            maxAge: 0,
            expires: new Date(0),
            path: "/",
            sameSite: "lax",
            secure: isProduction(),
            httpOnly: false,
          });
        }
      });
    } catch {
      // Ignore errors reading cookies
    }

    return response;
  } catch (_error) {
    // Even on error, try to clear cookies and return success
    // This ensures the user can sign out even if there's a server issue
    const response = success({ signedOut: true, hadError: true });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "default";

    // Clear basic auth cookies even on error
    [`sb-${projectRef}-auth-token`, "sb-access-token", "sb-refresh-token"].forEach((cookieName) => {
      response.cookies.set(cookieName, "", {
        maxAge: 0,
        expires: new Date(0),
        path: "/",
        sameSite: "lax",
        secure: isProduction(),
        httpOnly: false,
      });
    });

    return response;
  }
}

// Also handle GET requests for compatibility
export async function GET() {
  return POST();
}

/**
 * DEPRECATED: Use @/lib/auth/unified-auth instead
 *
 * This module is kept for backward compatibility during migration.
 * All new code should use withUnifiedAuth() from @/lib/auth/unified-auth
 *
 * @deprecated Use withUnifiedAuth() wrapper instead
 */

import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { requireAuthAndVenueAccess } from "@/lib/auth/unified-auth";
import type { User } from "@supabase/supabase-js";
import type { AuthContext } from "@/lib/auth/unified-auth";
import { NextResponse } from "next/server";

// Backward-compatible wrapper for requireVenueAccessForAPI
// This maintains the old signature: requireVenueAccessForAPI(venueId, request?)
// But internally uses the new unified system
// NOTE: This is a temporary compatibility layer. Routes should migrate to withUnifiedAuth
// IMPORTANT: Always pass the request object for proper cookie reading
export async function requireVenueAccessForAPI(
  venueId: string | null | undefined,
  request?: NextRequest
): Promise<{ success: true; context: AuthContext } | { success: false; response: NextResponse }> {
  // Use provided request or create a minimal one
  // Routes should ALWAYS pass the actual request object for proper cookie reading
  const req =
    request ||
    new NextRequest("http://localhost", {
      method: "GET",
      headers: new Headers(),
    });

  return await requireAuthAndVenueAccess(req, venueId);
}

// Re-export type for backward compatibility
export type { AuthContext as AuthorizedContext } from "@/lib/auth/unified-auth";

// Legacy requireAuthForAPI - use withUnifiedAuth wrapper instead
// Now accepts optional request to read cookies from request (more reliable)
export async function requireAuthForAPI(
  request?: NextRequest
): Promise<{ user: User | null; error: string | null }> {
  // If request is provided, use request-based auth (more reliable in API routes)
  if (request) {
    const { getAuthUserFromRequest } = await import("@/lib/auth/unified-auth");
    return await getAuthUserFromRequest(request);
  }

  // Fallback to cookie-based auth for backward compatibility
  const { user, error } = await getAuthenticatedUser();
  return { user, error };
}

// Legacy helper - use withUnifiedAuth wrapper instead
export function extractVenueId(req: Request): string | null {
  try {
    const url = new URL(req.url);
    return url.searchParams.get("venueId");
  } catch {
    return null;
  }
}

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
// This maintains the old signature: requireVenueAccessForAPI(venueId)
// But internally uses the new unified system
// NOTE: This is a temporary compatibility layer. Routes should migrate to withUnifiedAuth
export async function requireVenueAccessForAPI(
  venueId: string | null | undefined,
  request?: NextRequest
): Promise<
  | { success: true; context: AuthContext }
  | { success: false; response: NextResponse }
> {
  // Use provided request or create a minimal one
  // Routes should pass the actual request object
  const req = request || new NextRequest("http://localhost", {
    method: "GET",
    headers: new Headers(),
  });
  
  return await requireAuthAndVenueAccess(req, venueId);
}

// Re-export type for backward compatibility
export type { AuthContext as AuthorizedContext } from "@/lib/auth/unified-auth";

// Legacy requireAuthForAPI - use withUnifiedAuth wrapper instead
export async function requireAuthForAPI(): Promise<{ user: User | null; error: string | null }> {
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


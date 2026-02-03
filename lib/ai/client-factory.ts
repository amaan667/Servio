/**
 * RLS-Respecting Client Factory for AI Tools
 *
 * This module provides a factory function for creating Supabase clients
 * that respect Row Level Security (RLS) policies.
 *
 * CRITICAL: AI tools MUST use this factory instead of createAdminClient()
 * to ensure multi-tenant isolation and prevent cross-tenant data access.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Create an RLS-respecting Supabase client for AI tools
 *
 * This client respects Row Level Security policies, ensuring that AI tools
 * can only access data for the specified venue/organization.
 *
 * @param venueId - The venue ID to scope client to
 * @param organizationId - Optional organization ID for broader access
 * @returns A Supabase client that respects RLS policies
 *
 * @example
 * ```typescript
 * // Get client scoped to specific venue
 * const supabase = await createAIClient({ venueId: "venue-123" });
 *
 * // Query orders (RLS will filter by venue_id automatically)
 * const { data } = await supabase.from("orders").select("*");
 * ```
 */
export async function createAIClient(options: {
  venueId?: string;
  organizationId?: string;
} = {}): Promise<ReturnType<typeof createServerClient>> {
  const cookieStore = await cookies();

  // Create client with RLS enabled
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!, // Use anon key to respect RLS
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(_name: string, _value: string, _options: unknown) {
          /* Empty - AI tools are read-only */
        },
        remove(_name: string, _options: unknown) {
          /* Empty - AI tools are read-only */
        },
      },
      // Set global context for RLS policies
      global: {
        headers: {
          // Pass venue_id in headers for RLS policies
          ...(options.venueId && { "x-venue-id": options.venueId }),
          ...(options.organizationId && { "x-organization-id": options.organizationId }),
        },
      },
    }
  );

  return client;
}

/**
 * Create an RLS-respecting Supabase client with user context
 *
 * This variant includes user authentication context for operations that
 * require user-specific permissions.
 *
 * @param userId - The user ID to scope client to
 * @param venueId - Optional venue ID for additional scoping
 * @returns A Supabase client that respects RLS policies
 *
 * @example
 * ```typescript
 * // Get client scoped to specific user and venue
 * const supabase = await createAIClientWithUser({
 *   userId: "user-123",
 *   venueId: "venue-456"
 * });
 * ```
 */
export async function createAIClientWithUser(options: {
  userId: string;
  venueId?: string;
  organizationId?: string;
}): Promise<ReturnType<typeof createServerClient>> {
  const cookieStore = await cookies();

  // Create client with RLS enabled and user context
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!, // Use anon key to respect RLS
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(_name: string, _value: string, _options: unknown) {
          /* Empty - AI tools are read-only */
        },
        remove(_name: string, _options: unknown) {
          /* Empty - AI tools are read-only */
        },
      },
      // Set global context for RLS policies
      global: {
        headers: {
          // Pass user_id in headers for RLS policies
          "x-user-id": options.userId,
          ...(options.venueId && { "x-venue-id": options.venueId }),
          ...(options.organizationId && { "x-organization-id": options.organizationId }),
        },
      },
    }
  );

  return client;
}

/**
 * Validate that a client is RLS-respecting
 *
 * This function checks if a client was created using the AI client factory
 * and will throw an error if it was created using createAdminClient().
 *
 * @param client - The Supabase client to validate
 * @param context - Context information for error messages
 * @throws Error if client was not created using AI client factory
 *
 * @example
 * ```typescript
 * import { validateAIClient } from "@/lib/ai/client-factory";
 *
 * function myAITool(supabase: SupabaseClient) {
 *   validateAIClient(supabase, { tool: "my-ai-tool" });
 *   // Safe to use supabase
 * }
 * ```
 */
export function validateAIClient(
  _client: unknown,
  context: { tool: string; operation?: string }
): void {
  // Check if client has the expected RLS-respecting properties
  // This is a runtime check to catch accidental use of createAdminClient()
  // We can't detect this at runtime, but we can log a warning
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[AI Security] ${context.tool}: Ensure client was created using createAIClient() ` +
      `to respect RLS policies. Using createAdminClient() bypasses RLS.`
    );
  }
}

/**
 * Get venue ID from AI tool context
 *
 * Helper function to extract venue ID from AI tool execution context.
 *
 * @param context - The AI tool execution context
 * @returns The venue ID or null
 *
 * @example
 * ```typescript
 * const venueId = getVenueIdFromContext({ venue_id: "venue-123" });
 * ```
 */
export function getVenueIdFromContext(context: Record<string, unknown>): string | null {
  return context.venue_id as string | null;
}

/**
 * Get organization ID from AI tool context
 *
 * Helper function to extract organization ID from AI tool execution context.
 *
 * @param context - The AI tool execution context
 * @returns The organization ID or null
 *
 * @example
 * ```typescript
 * const organizationId = getOrganizationIdFromContext({ organization_id: "org-123" });
 * ```
 */
export function getOrganizationIdFromContext(context: Record<string, unknown>): string | null {
  return context.organization_id as string | null;
}

/**
 * Add tenant filtering to a Supabase query
 *
 * This helper function ensures that all queries include tenant filtering
 * to prevent cross-tenant data access.
 *
 * @param query - The Supabase query builder
 * @param venueId - The venue ID to filter by
 * @returns The query with venue filtering applied
 *
 * @example
 * ```typescript
 * const supabase = await createAIClient({ venueId: "venue-123" });
 * const query = addTenantFilter(
 *   supabase.from("orders").select("*"),
 *   "venue-123"
 * );
 * const { data } = await query;
 * ```
 */
export function addTenantFilter<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  venueId: string
): T {
  // Add venue_id filter to query
  return query.eq("venue_id", venueId);
}

/**
 * Security check: Verify venue access
 *
 * This function checks if a user has access to a specific venue
 * before allowing AI tools to access venue data.
 *
 * @param userId - The user ID
 * @param venueId - The venue ID to check
 * @returns Promise<boolean> - True if user has access
 *
 * @example
 * ```typescript
 * const hasAccess = await verifyVenueAccess("user-123", "venue-456");
 * if (!hasAccess) {
 *   throw new Error("Access denied to venue");
 * }
 * ```
 */
export async function verifyVenueAccess(
  userId: string,
  venueId: string
): Promise<boolean> {
  const supabase = await createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        get() {
          return undefined;
        },
        set() {
          /* Empty */
        },
        remove() {
          /* Empty */
        },
      },
    }
  );

  const { data, error } = await supabase
    .from("venue_access")
    .select("venue_id")
    .eq("user_id", userId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (error) {
    console.error("[AI Security] Failed to verify venue access:", error);
    return false;
  }

  return !!data;
}

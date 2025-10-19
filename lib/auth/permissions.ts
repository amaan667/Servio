// Centralized RBAC with Capability-Based Permissions
// Single source of truth for access control

import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Types
// ============================================================================

export type UserRole = "owner" | "manager" | "staff" | "viewer";

export type Capability =
  // Venue capabilities
  | "venue.read"
  | "venue.manage"
  | "venue.delete"
  // Menu capabilities
  | "menu.create"
  | "menu.update"
  | "menu.delete"
  | "menu.translate"
  // Order capabilities
  | "order.read"
  | "order.create"
  | "order.update"
  | "order.complete"
  | "order.delete"
  // Inventory capabilities
  | "inventory.read"
  | "inventory.adjust"
  | "inventory.manage"
  // Analytics capabilities
  | "analytics.read"
  | "analytics.export"
  // Staff management
  | "staff.read"
  | "staff.manage"
  // Discount capabilities
  | "discount.create"
  | "discount.update"
  | "discount.delete"
  // KDS capabilities
  | "kds.read"
  | "kds.update";

// ============================================================================
// Role-Capability Mapping
// ============================================================================

const RoleCaps: Record<UserRole, Capability[]> = {
  owner: [
    // Venue
    "venue.read",
    "venue.manage",
    "venue.delete",
    // Menu
    "menu.create",
    "menu.update",
    "menu.delete",
    "menu.translate",
    // Orders
    "order.read",
    "order.create",
    "order.update",
    "order.complete",
    "order.delete",
    // Inventory
    "inventory.read",
    "inventory.adjust",
    "inventory.manage",
    // Analytics
    "analytics.read",
    "analytics.export",
    // Staff
    "staff.read",
    "staff.manage",
    // Discounts
    "discount.create",
    "discount.update",
    "discount.delete",
    // KDS
    "kds.read",
    "kds.update",
  ],
  manager: [
    // Venue (read-only)
    "venue.read",
    // Menu
    "menu.create",
    "menu.update",
    "menu.delete",
    "menu.translate",
    // Orders
    "order.read",
    "order.create",
    "order.update",
    "order.complete",
    // Inventory
    "inventory.read",
    "inventory.adjust",
    // Analytics
    "analytics.read",
    "analytics.export",
    // Staff (read-only)
    "staff.read",
    // Discounts
    "discount.create",
    "discount.update",
    "discount.delete",
    // KDS
    "kds.read",
    "kds.update",
  ],
  staff: [
    // Venue (read-only)
    "venue.read",
    // Menu (read-only)
    "menu.create", // Can create orders
    // Orders
    "order.read",
    "order.create",
    "order.update",
    "order.complete",
    // Inventory (read-only)
    "inventory.read",
    // Analytics (read-only)
    "analytics.read",
    // KDS
    "kds.read",
    "kds.update",
  ],
  viewer: [
    // Venue (read-only)
    "venue.read",
    // Menu (read-only)
    // Orders (read-only)
    "order.read",
    // Inventory (read-only)
    "inventory.read",
    // Analytics (read-only)
    "analytics.read",
    // KDS (read-only)
    "kds.read",
  ],
};

// ============================================================================
// Core Permission Functions
// ============================================================================

/**
 * Check if a role has a specific capability
 */
export function can(role: UserRole, action: Capability): boolean {
  return RoleCaps[role]?.includes(action) ?? false;
}

/**
 * Get all capabilities for a role
 */
export function getCapabilities(role: UserRole): Capability[] {
  return RoleCaps[role] ?? [];
}

// ============================================================================
// Venue Membership Resolution
// ============================================================================

export type VenueMembership = {
  venueId: string;
  role: UserRole;
  userId: string;
};

export type VenueAccessResult = {
  role: UserRole;
  membership: VenueMembership | null;
};

/**
 * Resolve user's role for a venue
 * Checks both venue_memberships table and owner_id fallback
 */
export async function resolveVenueRole(
  userId: string,
  venueId: string
): Promise<VenueAccessResult> {
  const supabase = await createClient();

  // Try to get from venue_memberships table
  const { data: membership, error } = await supabase
    .from("user_venue_roles")
    .select("role, venue_id, venues(owner_id)")
    .eq("venue_id", venueId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[AUTH DEBUG] Error fetching venue membership:", error);
    // Fallback to venue ownership check
    const { data: venue } = await supabase
      .from("venues")
      .select("owner_id")
      .eq("venue_id", venueId)
      .single();

    if (venue && venue.owner_id === userId) {
      return {
        role: "owner",
        membership: { venueId, role: "owner", userId },
      };
    }

    // Default to viewer if no membership found
    return {
      role: "viewer",
      membership: null,
    };
  }

  // If we have a membership, use its role
  if (membership) {
    return {
      role: membership.role as UserRole,
      membership: {
        venueId,
        role: membership.role as UserRole,
        userId,
      },
    };
  }

  // Fallback: check if user is owner
  const venue = membership?.venues as { owner_id: string } | undefined;
  if (venue && venue.owner_id === userId) {
    return {
      role: "owner",
      membership: { venueId, role: "owner", userId },
    };
  }

  // No access found
  return {
    role: "viewer",
    membership: null,
  };
}

// ============================================================================
// Capability Assertion
// ============================================================================

export class PermissionError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403,
    public capability?: Capability,
    public role?: UserRole
  ) {
    super(message);
    this.name = "PermissionError";
  }
}

/**
 * Assert that a user has a specific capability for a venue
 * Throws PermissionError if access is denied
 *
 * @param userId - The user ID
 * @param venueId - The venue ID
 * @param action - The capability to check
 * @returns The resolved role and membership
 * @throws PermissionError if access is denied
 */
export async function assertVenueCapability(
  userId: string,
  venueId: string,
  action: Capability
): Promise<VenueAccessResult> {
  const { role, membership } = await resolveVenueRole(userId, venueId);

  if (!can(role, action)) {
    throw new PermissionError(
      `User does not have permission to perform '${action}' on this venue`,
      403,
      action,
      role
    );
  }

  return { role, membership };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check if user can perform action (non-throwing version)
 */
export async function hasVenueCapability(
  userId: string,
  venueId: string,
  action: Capability
): Promise<boolean> {
  try {
    await assertVenueCapability(userId, venueId, action);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get user's role for a venue (non-throwing)
 */
export async function getUserVenueRole(
  userId: string,
  venueId: string
): Promise<UserRole> {
  const { role } = await resolveVenueRole(userId, venueId);
  return role;
}

// ============================================================================
// Backward Compatibility Adapters
// ============================================================================

/**
 * @deprecated Use assertVenueCapability instead
 * Check if user is owner of venue
 */
export async function isVenueOwner(
  userId: string,
  venueId: string
): Promise<boolean> {
  const role = await getUserVenueRole(userId, venueId);
  return role === "owner";
}

/**
 * @deprecated Use assertVenueCapability instead
 * Check if user is manager or owner
 */
export async function isVenueManager(
  userId: string,
  venueId: string
): Promise<boolean> {
  const role = await getUserVenueRole(userId, venueId);
  return role === "owner" || role === "manager";
}

/**
 * @deprecated Use assertVenueCapability instead
 * Check if user is staff, manager, or owner
 */
export async function isVenueStaff(
  userId: string,
  venueId: string
): Promise<boolean> {
  const role = await getUserVenueRole(userId, venueId);
  return role === "owner" || role === "manager" || role === "staff";
}


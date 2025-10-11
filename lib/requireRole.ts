/**
 * Server-side role enforcement helper
 * Use this in API routes to enforce role-based access control
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type UserRole = 'owner' | 'manager' | 'staff' | 'kitchen';

export class ForbiddenError extends Error {
  status: number;
  
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.status = 403;
  }
}

/**
 * Requires the current user to have one of the specified roles for the venue
 * @throws ForbiddenError if user doesn't have required role
 * @returns The user's actual role
 */
export async function requireRole(
  supabase: SupabaseClient,
  venueId: string,
  allowedRoles: UserRole[]
): Promise<UserRole> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new ForbiddenError('Not authenticated');
  }

  // Query for current user's role (RLS only allows seeing own roles)
  const { data, error } = await supabase
    .from('user_venue_roles')
    .select('role')
    .eq('venue_id', venueId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[RBAC] Error checking role:', error);
    throw new ForbiddenError('Failed to verify permissions');
  }

  if (!data) {
    throw new ForbiddenError('You are not a member of this venue');
  }

  const userRole = data.role as UserRole;

  if (!allowedRoles.includes(userRole)) {
    throw new ForbiddenError(
      `This action requires one of the following roles: ${allowedRoles.join(', ')}. Your role: ${userRole}`
    );
  }

  return userRole;
}

/**
 * Gets the current user's role for a venue (without throwing)
 * @returns The user's role or null if not a member
 */
export async function getUserRole(
  supabase: SupabaseClient,
  venueId: string
): Promise<UserRole | null> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  // Query for current user's role (RLS only allows seeing own roles)
  const { data, error } = await supabase
    .from('user_venue_roles')
    .select('role')
    .eq('venue_id', venueId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.role as UserRole;
}

/**
 * Checks if the current user has at least one of the specified roles
 */
export async function hasRole(
  supabase: SupabaseClient,
  venueId: string,
  roles: UserRole[]
): Promise<boolean> {
  const userRole = await getUserRole(supabase, venueId);
  return userRole ? roles.includes(userRole) : false;
}

/**
 * Sets the audit reason for role changes (used by triggers)
 */
export async function setAuditReason(
  supabase: SupabaseClient,
  reason: string
): Promise<void> {
  try {
    // This sets a session variable that will be picked up by the trigger
    await supabase.rpc('set_session_config', {
      setting_name: 'app.role_reason',
      new_value: reason || '',
      is_local: true
    });
  } catch (error) {
    // Silently fail - audit reason is nice-to-have, not critical
    console.warn('[RBAC] Could not set audit reason:', error);
  }
}

/**
 * Permission helpers matching the frontend permission matrix
 */
export const PERMISSIONS = {
  // Owner only
  MANAGE_ROLES: ['owner'] as UserRole[],
  MANAGE_BILLING: ['owner'] as UserRole[],
  MANAGE_BRANDING: ['owner'] as UserRole[],
  DELETE_VENUE: ['owner'] as UserRole[],
  
  // Owner + Manager
  MANAGE_MENU: ['owner', 'manager'] as UserRole[],
  MANAGE_TABLES: ['owner', 'manager'] as UserRole[],
  MANAGE_INVENTORY: ['owner', 'manager'] as UserRole[],
  VIEW_ANALYTICS: ['owner', 'manager'] as UserRole[],
  MANAGE_SETTINGS: ['owner', 'manager'] as UserRole[],
  INVITE_TEAM: ['owner', 'manager'] as UserRole[],
  
  // All roles
  VIEW_ORDERS: ['owner', 'manager', 'staff', 'kitchen'] as UserRole[],
  MANAGE_ORDERS: ['owner', 'manager', 'staff', 'kitchen'] as UserRole[],
  VIEW_MENU: ['owner', 'manager', 'staff', 'kitchen'] as UserRole[],
  VIEW_TABLES: ['owner', 'manager', 'staff', 'kitchen'] as UserRole[],
} as const;


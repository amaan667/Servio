// Permission checking utilities for Servio
// Implements role-based access control (RBAC)

export type Role = 'owner' | 'manager' | 'staff' | 'kitchen' | 'server' | 'cashier';

export interface UserPermissions {
  userId: string;
  venueId: string;
  role: Role;
  permissions: Record<string, boolean>;
}

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 6,
  manager: 5,
  staff: 4,
  server: 3,
  cashier: 2,
  kitchen: 1,
};

// Permission definitions
export const PERMISSIONS = {
  // Venue management
  VENUE_VIEW: 'venue:view',
  VENUE_EDIT: 'venue:edit',
  VENUE_DELETE: 'venue:delete',
  
  // Staff management
  STAFF_VIEW: 'staff:view',
  STAFF_INVITE: 'staff:invite',
  STAFF_EDIT: 'staff:edit',
  STAFF_DELETE: 'staff:delete',
  
  // Menu management
  MENU_VIEW: 'menu:view',
  MENU_EDIT: 'menu:edit',
  MENU_DELETE: 'menu:delete',
  
  // Order management
  ORDERS_VIEW: 'orders:view',
  ORDERS_CREATE: 'orders:create',
  ORDERS_EDIT: 'orders:edit',
  ORDERS_DELETE: 'orders:delete',
  
  // Kitchen display
  KDS_VIEW: 'kds:view',
  KDS_UPDATE: 'kds:update',
  
  // Analytics
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',
  
  // Inventory
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_EDIT: 'inventory:edit',
  
  // Billing
  BILLING_VIEW: 'billing:view',
  BILLING_EDIT: 'billing:edit',
  
  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
} as const;

// Role-based permission matrix
const ROLE_PERMISSIONS: Record<Role, string[]> = {
  owner: [
    // All permissions
    PERMISSIONS.VENUE_VIEW,
    PERMISSIONS.VENUE_EDIT,
    PERMISSIONS.VENUE_DELETE,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.STAFF_INVITE,
    PERMISSIONS.STAFF_EDIT,
    PERMISSIONS.STAFF_DELETE,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.MENU_EDIT,
    PERMISSIONS.MENU_DELETE,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_EDIT,
    PERMISSIONS.ORDERS_DELETE,
    PERMISSIONS.KDS_VIEW,
    PERMISSIONS.KDS_UPDATE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_EDIT,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
  ],
  
  manager: [
    PERMISSIONS.VENUE_VIEW,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.STAFF_INVITE,
    PERMISSIONS.STAFF_EDIT,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.MENU_EDIT,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_EDIT,
    PERMISSIONS.KDS_VIEW,
    PERMISSIONS.KDS_UPDATE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.SETTINGS_VIEW,
  ],
  
  staff: [
    PERMISSIONS.VENUE_VIEW,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_EDIT,
    PERMISSIONS.KDS_VIEW,
    PERMISSIONS.KDS_UPDATE,
    PERMISSIONS.INVENTORY_VIEW,
  ],
  
  server: [
    PERMISSIONS.VENUE_VIEW,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_EDIT,
    PERMISSIONS.KDS_VIEW,
  ],
  
  cashier: [
    PERMISSIONS.VENUE_VIEW,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_EDIT,
  ],
  
  kitchen: [
    PERMISSIONS.VENUE_VIEW,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.KDS_VIEW,
    PERMISSIONS.KDS_UPDATE,
    PERMISSIONS.INVENTORY_VIEW,
  ],
};

// Check if a role has a specific permission
export function hasPermission(role: Role, permission: string): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  return rolePermissions.includes(permission);
}

// Check if a role can perform an action on another role
export function canManageRole(userRole: Role, targetRole: Role): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
  
  // Users can only manage roles with lower hierarchy levels
  return userLevel > targetLevel;
}

// Get all permissions for a role
export function getRolePermissions(role: Role): string[] {
  return ROLE_PERMISSIONS[role] || [];
}

// Check if user has permission for a specific venue
export function checkVenuePermission(
  userPermissions: UserPermissions,
  permission: string,
  venueId?: string
): boolean {
  // Check if user has access to the venue
  if (venueId && userPermissions.venueId !== venueId) {
    return false;
  }
  
  // Check if user has the specific permission
  return hasPermission(userPermissions.role, permission);
}

// Create permission checker function
export function createPermissionChecker(userPermissions: UserPermissions) {
  return {
    has: (permission: string, venueId?: string) => 
      checkVenuePermission(userPermissions, permission, venueId),
    
    canManageRole: (targetRole: Role) => 
      canManageRole(userPermissions.role, targetRole),
    
    canInviteStaff: () => 
      hasPermission(userPermissions.role, PERMISSIONS.STAFF_INVITE),
    
    canEditMenu: () => 
      hasPermission(userPermissions.role, PERMISSIONS.MENU_EDIT),
    
    canViewAnalytics: () => 
      hasPermission(userPermissions.role, PERMISSIONS.ANALYTICS_VIEW),
    
    canManageInventory: () => 
      hasPermission(userPermissions.role, PERMISSIONS.INVENTORY_EDIT),
    
    canAccessKDS: () => 
      hasPermission(userPermissions.role, PERMISSIONS.KDS_VIEW),
    
    canUpdateKDS: () => 
      hasPermission(userPermissions.role, PERMISSIONS.KDS_UPDATE),
    
    canManageOrders: () => 
      hasPermission(userPermissions.role, PERMISSIONS.ORDERS_EDIT),
    
    canViewBilling: () => 
      hasPermission(userPermissions.role, PERMISSIONS.BILLING_VIEW),
    
    canEditSettings: () => 
      hasPermission(userPermissions.role, PERMISSIONS.SETTINGS_EDIT),
    
    isOwner: () => userPermissions.role === 'owner',
    isManager: () => userPermissions.role === 'manager',
    isStaff: () => userPermissions.role === 'staff',
    isKitchen: () => userPermissions.role === 'kitchen',
    isServer: () => userPermissions.role === 'server',
    isCashier: () => userPermissions.role === 'cashier',
  };
}

// Helper to get user permissions from database
export async function getUserPermissions(
  supabase: any,
  userId: string,
  venueId: string
): Promise<UserPermissions | null> {
  try {
    const { data, error } = await supabase
      .from('user_venue_roles')
      .select('role, permissions')
      .eq('user_id', userId)
      .eq('venue_id', venueId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      userId,
      venueId,
      role: data.role as Role,
      permissions: data.permissions || {},
    };
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return null;
  }
}

// Middleware helper for API routes
export function requirePermission(permission: string) {
  return async (req: any, res: any, next: any) => {
    try {
      // This would be implemented based on your auth system
      // For now, it's a placeholder
      next();
    } catch (error) {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
}

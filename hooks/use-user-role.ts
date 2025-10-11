"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export interface UserRole {
  role: string;
  venue_id: string;
  organization_id?: string;
}

export interface RolePermissions {
  canViewAnalytics: boolean;
  canManageMenu: boolean;
  canManageInventory: boolean;
  canManageStaff: boolean;
  canManageSettings: boolean;
  canManageBilling: boolean;
  canUseKDS: boolean;
  canManageTables: boolean;
  canViewLiveOrders: boolean;
  canUpdateOrderStatus: boolean;
  canManageRoles: boolean;
}

const ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  owner: {
    canViewAnalytics: true,
    canManageMenu: true,
    canManageInventory: true,
    canManageStaff: true,
    canManageSettings: true,
    canManageBilling: true,
    canUseKDS: true,
    canManageTables: true,
    canViewLiveOrders: true,
    canUpdateOrderStatus: true,
    canManageRoles: true,
  },
  manager: {
    canViewAnalytics: true,
    canManageMenu: true,
    canManageInventory: false,
    canManageStaff: true,
    canManageSettings: false,
    canManageBilling: false,
    canUseKDS: true,
    canManageTables: true,
    canViewLiveOrders: true,
    canUpdateOrderStatus: true,
    canManageRoles: false,
  },
  staff: {
    canViewAnalytics: false,
    canManageMenu: false,
    canManageInventory: false,
    canManageStaff: false,
    canManageSettings: false,
    canManageBilling: false,
    canUseKDS: true,
    canManageTables: true,
    canViewLiveOrders: true,
    canUpdateOrderStatus: true,
    canManageRoles: false,
  },
  kitchen: {
    canViewAnalytics: false,
    canManageMenu: false,
    canManageInventory: false,
    canManageStaff: false,
    canManageSettings: false,
    canManageBilling: false,
    canUseKDS: true,
    canManageTables: false,
    canViewLiveOrders: false,
    canUpdateOrderStatus: true,
    canManageRoles: false,
  },
};

export function useUserRole(venueId: string) {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        setLoading(true);
        setError(null);

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setError("User not authenticated");
          return;
        }

        // Fetch user role from user_venue_roles table
        const { data: roleData, error: roleError } = await supabase
          .from("user_venue_roles")
          .select("role, venue_id, organization_id")
          .eq("venue_id", venueId)
          .eq("user_id", user.id)
          .single();

        if (roleError) {
          // If no role found, default to owner (for existing users)
          console.warn("No role found, defaulting to owner:", roleError);
          const defaultRole: UserRole = {
            role: "owner",
            venue_id: venueId,
          };
          setUserRole(defaultRole);
          setPermissions(ROLE_PERMISSIONS.owner);
        } else if (roleData) {
          setUserRole(roleData);
          setPermissions(ROLE_PERMISSIONS[roleData.role] || ROLE_PERMISSIONS.owner);
        }
      } catch (err: any) {
        console.error("Error fetching user role:", err);
        setError(err.message || "Failed to fetch user role");
      } finally {
        setLoading(false);
      }
    };

    if (venueId) {
      fetchUserRole();
    }
  }, [venueId]);

  const updateRole = async (newRole: string): Promise<boolean> => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError("User not authenticated");
        return false;
      }

      const { error } = await supabase
        .from("user_venue_roles")
        .update({ role: newRole })
        .eq("venue_id", venueId)
        .eq("user_id", user.id);

      if (error) {
        setError(error.message);
        return false;
      }

      // Update local state
      setUserRole(prev => prev ? { ...prev, role: newRole } : null);
      setPermissions(ROLE_PERMISSIONS[newRole] || ROLE_PERMISSIONS.owner);
      return true;
    } catch (err: any) {
      console.error("Error updating role:", err);
      setError(err.message || "Failed to update role");
      return false;
    }
  };

  const hasPermission = (permission: keyof RolePermissions): boolean => {
    return permissions?.[permission] || false;
  };

  const canAccess = (feature: keyof RolePermissions): boolean => {
    return hasPermission(feature);
  };

  return {
    userRole,
    permissions,
    loading,
    error,
    updateRole,
    hasPermission,
    canAccess,
  };
}

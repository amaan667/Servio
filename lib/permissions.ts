// Role-based permissions system

export type UserRole = "owner" | "manager" | "staff" | "kitchen" | "server" | "cashier";

export interface RolePermissions {
  // Orders & Analytics

}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {

  },

  },

  },

  },

  },

  },
};

export function hasPermission(role: UserRole, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

export function canAccess(role: UserRole, feature: string): boolean {
  const featurePermissions: Record<string, keyof RolePermissions> = {

    "menu-edit": "editMenu",

    "inventory-edit": "editInventory",

    "staff-manage": "manageStaff",
    "staff-roles": "manageStaffRoles",
    "staff-schedules": "manageStaffSchedules",

    "settings-edit": "editSettings",

    "billing-edit": "editBilling",

    "tables-manage": "manageTables",

  };

  const permission = featurePermissions[feature];
  return permission ? hasPermission(role, permission) : false;
}

export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {

  };
  return names[role] || role;
}

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {

  };
  return colors[role] || "bg-gray-100 text-gray-800 border-gray-200";
}

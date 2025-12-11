// Role-based permissions system

export type UserRole = "owner" | "manager" | "staff" | "kitchen" | "server" | "cashier";

export interface RolePermissions {
  // Orders & Analytics
  viewOrders: boolean;
  viewAnalytics: boolean;

  // Menu & Inventory
  viewMenu: boolean;
  editMenu: boolean;
  viewInventory: boolean;
  editInventory: boolean;
  updateItemAvailability: boolean;

  // Staff Management
  viewStaff: boolean;
  manageStaff: boolean;
  manageStaffRoles: boolean;
  manageStaffSchedules: boolean;

  // Venue & Settings
  viewSettings: boolean;
  editSettings: boolean;
  viewBilling: boolean;
  editBilling: boolean;
  deleteVenue: boolean;

  // Kitchen Display System
  viewKDS: boolean;
  updateOrderStatus: boolean;

  // Table Management
  viewTables: boolean;
  manageTables: boolean;
  viewActiveSessions: boolean;

  // Payments
  processPayments: boolean;
  issueRefunds: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  owner: {
    viewOrders: true,
    viewAnalytics: true,
    viewMenu: true,
    editMenu: true,
    viewInventory: true,
    editInventory: true,
    updateItemAvailability: true,
    viewStaff: true,
    manageStaff: true,
    manageStaffRoles: true,
    manageStaffSchedules: true,
    viewSettings: true,
    editSettings: true,
    viewBilling: true,
    editBilling: true,
    deleteVenue: true,
    viewKDS: true,
    updateOrderStatus: true,
    viewTables: true,
    manageTables: true,
    viewActiveSessions: true,
    processPayments: true,
    issueRefunds: true,
  },
  manager: {
    viewOrders: true,
    viewAnalytics: true,
    viewMenu: true,
    editMenu: true,
    viewInventory: true,
    editInventory: true,
    updateItemAvailability: true,
    viewStaff: true,
    manageStaff: true,
    manageStaffRoles: false,
    manageStaffSchedules: true,
    viewSettings: true,
    editSettings: true,
    viewBilling: false,
    editBilling: false,
    deleteVenue: false,
    viewKDS: true,
    updateOrderStatus: true,
    viewTables: true,
    manageTables: true,
    viewActiveSessions: true,
    processPayments: true,
    issueRefunds: true,
  },
  staff: {
    viewOrders: true,
    viewAnalytics: false,
    viewMenu: true,
    editMenu: false,
    viewInventory: true,
    editInventory: false,
    updateItemAvailability: true,
    viewStaff: false,
    manageStaff: false,
    manageStaffRoles: false,
    manageStaffSchedules: false,
    viewSettings: false,
    editSettings: false,
    viewBilling: false,
    editBilling: false,
    deleteVenue: false,
    viewKDS: false,
    updateOrderStatus: false,
    viewTables: true,
    manageTables: false,
    viewActiveSessions: true,
    processPayments: false,
    issueRefunds: false,
  },
  kitchen: {
    viewOrders: true,
    viewAnalytics: false,
    viewMenu: false,
    editMenu: false,
    viewInventory: false,
    editInventory: false,
    updateItemAvailability: false,
    viewStaff: false,
    manageStaff: false,
    manageStaffRoles: false,
    manageStaffSchedules: false,
    viewSettings: false,
    editSettings: false,
    viewBilling: false,
    editBilling: false,
    deleteVenue: false,
    viewKDS: true,
    updateOrderStatus: true,
    viewTables: false,
    manageTables: false,
    viewActiveSessions: false,
    processPayments: false,
    issueRefunds: false,
  },
  server: {
    viewOrders: true,
    viewAnalytics: false,
    viewMenu: true,
    editMenu: false,
    viewInventory: false,
    editInventory: false,
    updateItemAvailability: false,
    viewStaff: false,
    manageStaff: false,
    manageStaffRoles: false,
    manageStaffSchedules: false,
    viewSettings: false,
    editSettings: false,
    viewBilling: false,
    editBilling: false,
    deleteVenue: false,
    viewKDS: false,
    updateOrderStatus: false,
    viewTables: true,
    manageTables: false,
    viewActiveSessions: true,
    processPayments: true,
    issueRefunds: false,
  },
  cashier: {
    viewOrders: true,
    viewAnalytics: false,
    viewMenu: false,
    editMenu: false,
    viewInventory: false,
    editInventory: false,
    updateItemAvailability: false,
    viewStaff: false,
    manageStaff: false,
    manageStaffRoles: false,
    manageStaffSchedules: false,
    viewSettings: false,
    editSettings: false,
    viewBilling: false,
    editBilling: false,
    deleteVenue: false,
    viewKDS: false,
    updateOrderStatus: false,
    viewTables: false,
    manageTables: false,
    viewActiveSessions: false,
    processPayments: true,
    issueRefunds: true,
  },
};

export function hasPermission(role: UserRole, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

export function canAccess(role: UserRole, feature: string): boolean {
  const featurePermissions: Record<string, keyof RolePermissions> = {
    dashboard: "viewOrders",
    analytics: "viewAnalytics",
    menu: "viewMenu",
    "menu-edit": "editMenu",
    inventory: "viewInventory",
    "inventory-edit": "editInventory",
    staff: "viewStaff",
    "staff-manage": "manageStaff",
    "staff-roles": "manageStaffRoles",
    "staff-schedules": "manageStaffSchedules",
    settings: "viewSettings",
    "settings-edit": "editSettings",
    billing: "viewBilling",
    "billing-edit": "editBilling",
    kds: "viewKDS",
    tables: "viewTables",
    "tables-manage": "manageTables",
    payments: "processPayments",
  };

  const permission = featurePermissions[feature];
  return permission ? hasPermission(role, permission) : false;
}

export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    owner: "Owner",
    manager: "Manager",
    staff: "Staff",
    kitchen: "Kitchen",
    server: "Server",
    cashier: "Cashier",
  };
  return names[role] || role;
}

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    owner: "bg-purple-100 text-purple-800 border-purple-200",
    manager: "bg-blue-100 text-blue-800 border-blue-200",
    staff: "bg-green-100 text-green-800 border-green-200",
    kitchen: "bg-yellow-100 text-yellow-800 border-yellow-200",
    server: "bg-orange-100 text-orange-800 border-orange-200",
    cashier: "bg-amber-100 text-amber-800 border-amber-200",
  };
  return colors[role] || "bg-gray-100 text-gray-800 border-gray-200";
}

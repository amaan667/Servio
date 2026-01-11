import type { UserRole } from "@/lib/permissions";

// Type guard to check if a string is a valid UserRole
export function isValidUserRole(role: string | null | undefined): role is UserRole {
  const validRoles: UserRole[] = ["owner", "manager", "staff", "kitchen", "server", "cashier"];
  return role !== null && role !== undefined && validRoles.includes(role as UserRole);
}

// Helper to safely cast a string to UserRole with fallback
export function toUserRole(

}

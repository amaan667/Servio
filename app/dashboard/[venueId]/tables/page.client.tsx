"use client";

import { TableManagementClientNew } from "./table-management-client-new";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import type { UserRole } from "@/lib/permissions";

interface TablesClientPageProps {
  venueId: string;
  tier: string;
  role: string;
  initialTables?: Record<string, unknown>[] | null;
  initialReservations?: Record<string, unknown>[] | null;
  initialStats?: {
    total_tables: number;
    occupied: number;
    reserved: number;
    available: number;
  } | null;
}

export default function TablesClientPage({
  venueId,
  tier: _tier,
  role,
  initialTables,
  initialReservations,
  initialStats,
}: TablesClientPageProps) {
  const { user } = useAuthRedirect();
  const userRole = role as UserRole;

  // Render immediately - no blocking

  // Don't render if no user (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {user && userRole && (
          <RoleBasedNavigation
            venueId={venueId}
            userRole={userRole}
            userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
          />
        )}

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Table Management</h1>
          <p className="text-lg text-foreground mt-2">Manage tables, reservations, and seating</p>
        </div>

        <TableManagementClientNew
          venueId={venueId}
          initialTables={initialTables}
          initialReservations={initialReservations}
          initialStats={initialStats}
        />
      </div>
    </div>
  );
}

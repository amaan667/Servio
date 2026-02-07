"use client";

import StaffManagementClient from "./staff-client";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import type { UserRole } from "@/lib/permissions";
import type { StaffRow } from "./hooks/useStaffManagement";

interface StaffStats {
  total_staff: number;
  owners: number;
  managers: number;
  staff_count: number;
  active_staff: number;
}

export default function StaffClientPage({
  venueId,
  role,
  initialStaff,
  initialStats,
}: {
  venueId: string;
  tier: string;
  role: string;
  initialStaff?: StaffRow[];
  initialStats?: StaffStats;
}) {
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
        {/* Always render navigation if we have a venueId */}
        {venueId && (
          <RoleBasedNavigation
            venueId={venueId}
            userRole={userRole || "staff"}
            userName={user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}
          />
        )}

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Staff Management</h1>
          <p className="text-lg text-foreground mt-2">Manage staff roles and permissions</p>
        </div>

        <StaffManagementClient
          venueId={venueId}
          initialStaff={initialStaff}
          initialCounts={initialStats}
        />
      </div>
    </div>
  );
}

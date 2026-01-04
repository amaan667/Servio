"use client";

import { TableManagementClientNew } from "./table-management-client-new";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { useAccessContext } from "@/lib/access/useAccessContext";

export default function TablesClientPage({ venueId }: { venueId: string }) {
  const { user, isLoading: authLoading } = useAuthRedirect();
  const { role: userRole } = useAccessContext(venueId);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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

        <TableManagementClientNew venueId={venueId} />
      </div>
    </div>
  );
}

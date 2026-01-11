"use client";

import POSClient from "./pos-dashboard-client";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import type { UserRole } from "@/lib/permissions";

export default function POSClientPage({
  venueId,
  role,
}: {

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
        {user && userRole && (
          <RoleBasedNavigation
            venueId={venueId}
            userRole={userRole}
            userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
          />
        )}

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Point of Sale</h1>
          <p className="text-lg text-foreground mt-2">Process orders and payments</p>
        </div>

        <POSClient venueId={venueId} />
      </div>
    </div>
  );
}

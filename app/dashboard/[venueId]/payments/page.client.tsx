"use client";

import PaymentsClient from "./PaymentsClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
export default function PaymentsClientPage({
  venueId,
  tier,
  role,
}: {
  venueId: string;
  tier: string;
  role: string;
}) {
  const { user } = useAuthRedirect();
  const userRole = role;

  // Don't show loading spinner - just render when ready

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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Payments</h1>
          <p className="text-lg text-foreground mt-2">
            Manage payments, split bills, and view receipts
          </p>
        </div>

        <PaymentsClient venueId={venueId} />
      </div>
    </div>
  );
}

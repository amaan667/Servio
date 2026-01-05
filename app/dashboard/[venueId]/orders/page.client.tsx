"use client";

import OrdersClient from "./OrdersClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
export default function OrdersClientPage({
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Order Management</h1>
          <p className="text-lg text-foreground mt-2">View and manage all orders</p>
        </div>

        <OrdersClient venueId={venueId} />
      </div>
    </div>
  );
}

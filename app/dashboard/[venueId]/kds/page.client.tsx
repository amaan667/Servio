"use client";

import { useRouter } from "next/navigation";
import KDSClient from "./KDSClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { usePageAuth } from "../hooks/usePageAuth";

export default function KDSClientPage({ venueId }: { venueId: string }) {
  const router = useRouter();
  const { user, userRole, loading, authError } = usePageAuth({
    venueId,
    pageName: "Kitchen Display",
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">{authError}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!user || !userRole) {
    return null;
  }

  const canViewKDS = userRole === "owner" || userRole === "manager" || userRole === "kitchen";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={userRole as unknown}
          userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
        />

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Kitchen Display System
          </h1>
          <p className="text-lg text-foreground mt-2">
            Manage kitchen prep stations and ticket flow
          </p>
        </div>

        {canViewKDS ? (
          <KDSClient venueId={venueId} />
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Access Restricted</h3>
            <p className="text-yellow-700">
              You don&apos;t have permission to view the Kitchen Display System. This feature is
              available for Owner, Manager, and Kitchen roles only.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

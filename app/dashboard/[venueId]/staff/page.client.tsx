"use client";

import { useFeatureAuth } from "../hooks/useFeatureAuth";
import InvitationBasedStaffManagement from "@/components/staff/InvitationBasedStaffManagement";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useRouter } from "next/navigation";

export default function StaffClientPage({ venueId }: { venueId: string }) {
  const router = useRouter();
  const { user, userRole, venueName, loading, authError } = useFeatureAuth({
    venueId,
    featureName: "Staff Management",
    requiredRoles: ["owner", "manager"],
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={userRole as unknown}
          userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
        />

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Staff Management</h1>
          <p className="text-lg text-foreground mt-2">
            Manage your venue staff and their permissions
          </p>
        </div>

        <InvitationBasedStaffManagement venueId={venueId} venueName={venueName || "Your Venue"} />
      </div>
    </div>
  );
}

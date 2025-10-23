"use client";

import { useRouter } from "next/navigation";
import MenuManagementClient from "./MenuManagementClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { usePageAuth } from "../hooks/usePageAuth";

export default function MenuManagementClientPage({ venueId }: { venueId: string }) {
  const router = useRouter();
  const { user, userRole, authError } = usePageAuth({
    venueId,
    pageName: "Menu Management",
  });

  // No loading spinner - render immediately

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

  const canEditMenu = userRole === "owner" || userRole === "manager";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={userRole as unknown}
          userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
        />

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Menu Management</h1>
          <p className="text-lg text-foreground mt-2">
            {canEditMenu ? "Advanced menu management and organization" : "View menu items"}
          </p>
          {!canEditMenu && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Read-only mode:</strong> You can view menu items but cannot make changes.
                Only Owners and Managers can edit the menu.
              </p>
            </div>
          )}
        </div>

        <MenuManagementClient venueId={venueId} canEdit={canEditMenu} />
      </div>
    </div>
  );
}

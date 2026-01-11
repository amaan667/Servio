"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthProvider";
import MenuManagementClient from "./MenuManagementClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { UserRole } from "@/lib/permissions";

export default function MenuManagementClientPage({
  venueId,
  role,
}: {

}) {
  const { user } = useAuth();
  const router = useRouter();
  const userRole = role as UserRole;

  // Auth check - redirect non-signed-in users to select-plan page (non-blocking)
  useEffect(() => {
    if (!user) {
      router.push("/select-plan");
    }
  }, [user, router]);

  // Render immediately - no blocking

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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Menu Management</h1>
          <p className="text-lg text-foreground mt-2">
            Create and manage your menu items, categories, and pricing
          </p>
        </div>

        <MenuManagementClient venueId={venueId} />
      </div>
    </div>
  );
}

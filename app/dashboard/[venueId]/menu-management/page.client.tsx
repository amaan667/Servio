"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthProvider";
import MenuManagementClient from "./MenuManagementClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useAccessContext } from "@/lib/access/useAccessContext";

export default function MenuManagementClientPage({ venueId }: { venueId: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { role: userRole } = useAccessContext(venueId);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Auth check - redirect non-signed-in users to select-plan page
  useEffect(() => {
    const checkAuth = async () => {
      if (authLoading) return;

      if (!user) {
        // Not signed in - redirect to select-plan page
        router.push("/select-plan");
        return;
      }

      // User is signed in, continue with role check
      setCheckingAuth(false);
    };

    checkAuth();
  }, [user, authLoading, router]);

  // Show loading while checking auth
  if (authLoading || checkingAuth) {
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

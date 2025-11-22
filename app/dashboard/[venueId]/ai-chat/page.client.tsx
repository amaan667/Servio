"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase";
// AI Chat functionality will be implemented in the future
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { UserRole } from "@/lib/permissions";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { checkAccess } from "@/lib/access-control";
import { getUserTier } from "@/lib/tier-restrictions";
import { TierRestrictionBanner } from "@/components/TierRestrictionBanner";

export default function AIChatClientPage({ venueId }: { venueId: string }) {
  const { user, isLoading: authLoading } = useAuthRedirect();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [accessCheck, setAccessCheck] = useState<{
    allowed: boolean;
    reason?: string;
    currentTier?: string;
    requiredTier?: string;
  } | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.id) return;

      const supabase = supabaseBrowser();

      // Check cached role first
      const cachedRole = sessionStorage.getItem(`user_role_${user.id}`);
      if (cachedRole) {
        setUserRole(cachedRole);
        const tier = await getUserTier(user.id);
        const access = await checkAccess(user.id, cachedRole as UserRole, "ai-chat", "aiAssistant");
        setAccessCheck({ ...access, currentTier: tier });
        return;
      }

      // Check if owner
      const { data: ownerVenue } = await supabase
        .from("venues")
        .select("venue_id")
        .eq("owner_user_id", user.id)
        .eq("venue_id", venueId)
        .single();

      if (ownerVenue) {
        setUserRole("owner");
        sessionStorage.setItem(`user_role_${user.id}`, "owner");
        const tier = await getUserTier(user.id);
        const access = await checkAccess(user.id, "owner", "ai-chat", "aiAssistant");
        setAccessCheck({ ...access, currentTier: tier });
      } else {
        // Check staff role
        const { data: staffRole } = await supabase
          .from("user_venue_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("venue_id", venueId)
          .single();

        if (staffRole) {
          setUserRole(staffRole.role);
          sessionStorage.setItem(`user_role_${user.id}`, staffRole.role);
          const tier = await getUserTier(user.id);
          const access = await checkAccess(
            user.id,
            staffRole.role as UserRole,
            "ai-chat",
            "aiAssistant"
          );
          setAccessCheck({ ...access, currentTier: tier });
        }
      }
    };

    fetchUserRole();
  }, [user, venueId]);

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

  // Check tier access - AI Assistant requires Enterprise tier
  if (accessCheck && !accessCheck.allowed) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
          {user && userRole && (
            <RoleBasedNavigation
              venueId={venueId}
              userRole={userRole as UserRole}
              userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
            />
          )}
          <TierRestrictionBanner
            currentTier={accessCheck.currentTier || "starter"}
            requiredTier={accessCheck.requiredTier || "enterprise"}
            featureName="AI Assistant"
            venueId={venueId}
            reason={accessCheck.reason || "AI Assistant requires Enterprise tier"}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {user && userRole && (
          <RoleBasedNavigation
            venueId={venueId}
            userRole={userRole as UserRole}
            userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
          />
        )}

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Assistant</h1>
          <p className="text-lg text-foreground mt-2">
            Get help and insights from your AI assistant
          </p>
        </div>

        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Assistant</h2>
          <p className="text-gray-600">AI Chat functionality coming soon!</p>
        </div>
      </div>
    </div>
  );
}

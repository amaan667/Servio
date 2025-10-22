"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

interface UseFeatureAuthOptions {
  venueId: string;
  featureName: string;
  redirectPath?: string;
  requiredRoles?: string[];
}

interface UseFeatureAuthReturn {
  user: { id: string; user_metadata?: { full_name?: string }; email?: string } | null;
  userRole: string | null;
  venueName: string | null;
  loading: boolean;
  authError: string | null;
  hasAccess: boolean;
}

/**
 * Reusable hook for feature page authentication and authorization
 * Handles all auth checks client-side using supabaseBrowser
 */
export function useFeatureAuth({
  venueId,
  featureName,
  redirectPath,
  requiredRoles,
}: UseFeatureAuthOptions): UseFeatureAuthReturn {
  const router = useRouter();
  const [user, setUser] = useState<{
    id: string;
    user_metadata?: { full_name?: string };
    email?: string;
  } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [venueName, setVenueName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const supabase = supabaseBrowser();

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const currentUser = session?.user;

        if (!currentUser) {
          console.info(
            `⚠️  [${featureName.toUpperCase()} CLIENT] No user found, redirecting to sign-in`
          );
          const redirect =
            redirectPath ||
            `/dashboard/${venueId}/${featureName.toLowerCase().replace(/\s+/g, "-")}`;
          router.push(`/sign-in?redirect=${redirect}`);
          return;
        }

        console.info(`🔐 [${featureName.toUpperCase()} CLIENT] Auth check:`, {
          venueId,
          userId: currentUser.id,
          timestamp: new Date().toISOString(),
        });

        setUser(currentUser);

        // Check if user is the venue owner
        const { data: venue } = await supabase
          .from("venues")
          .select("venue_id, venue_name, owner_user_id")
          .eq("venue_id", venueId)
          .eq("owner_user_id", currentUser.id)
          .maybeSingle();

        // Check if user has a staff role for this venue
        const { data: roleData } = await supabase
          .from("user_venue_roles")
          .select("role")
          .eq("user_id", currentUser.id)
          .eq("venue_id", venueId)
          .maybeSingle();

        const isOwner = !!venue;
        const isStaff = !!roleData;

        console.info(`✅ [${featureName.toUpperCase()} CLIENT] Authorization check:`, {
          venueId,
          userId: currentUser.id,
          isOwner,
          isStaff,
          role: roleData?.role,
          timestamp: new Date().toISOString(),
        });

        if (!isOwner && !isStaff) {
          setAuthError("You don't have access to this venue");
          setLoading(false);
          return;
        }

        // Get venue name
        if (venue?.venue_name) {
          setVenueName(venue.venue_name as string);
        } else if (isStaff) {
          const { data: staffVenue } = await supabase
            .from("venues")
            .select("venue_name")
            .eq("venue_id", venueId)
            .single();
          if (staffVenue?.venue_name) {
            setVenueName(staffVenue.venue_name);
          }
        }

        const finalRole = roleData?.role || (isOwner ? "owner" : "staff");
        setUserRole(finalRole);

        // Check role-based access if required roles are specified
        if (requiredRoles && requiredRoles.length > 0) {
          const hasRequiredRole = requiredRoles.includes(finalRole);
          setHasAccess(hasRequiredRole);
          if (!hasRequiredRole) {
            setAuthError(`This feature requires one of these roles: ${requiredRoles.join(", ")}`);
          }
        } else {
          setHasAccess(true);
        }

        console.info(`🚀 [${featureName.toUpperCase()} CLIENT] Auth complete:`, {
          venueId,
          userId: currentUser.id,
          finalRole,
          hasAccess: requiredRoles ? requiredRoles.includes(finalRole) : true,
          timestamp: new Date().toISOString(),
        });

        setLoading(false);
      } catch (error) {
        console.error(`❌ [${featureName.toUpperCase()} CLIENT] Auth error:`, error);
        setAuthError("Failed to verify access");
        setLoading(false);
      }
    }

    checkAuth();
  }, [venueId, featureName, redirectPath, requiredRoles, router]);

  return {
    user,
    userRole,
    venueName,
    loading,
    authError,
    hasAccess,
  };
}

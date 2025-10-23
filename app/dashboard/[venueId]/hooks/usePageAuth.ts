"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

interface UsePageAuthOptions {
  venueId: string;
  pageName: string;
  redirectPath?: string;
  requiredRoles?: string[];
}

interface UsePageAuthReturn {
  user: {
    id: string;
    user_metadata?: { full_name?: string };
    email?: string;
  } | null;
  userRole: string | null;
  venueName: string;
  loading: boolean;
  authError: string | null;
  hasAccess: boolean;
}

/**
 * Shared authentication hook for all dashboard pages
 * Consolidates duplicate auth logic across page.client.tsx files
 */
export function usePageAuth({
  venueId,
  pageName,
  redirectPath,
  requiredRoles,
}: UsePageAuthOptions): UsePageAuthReturn {
  const router = useRouter();
  const [user, setUser] = useState<{
    id: string;
    user_metadata?: { full_name?: string };
    email?: string;
  } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [venueName, setVenueName] = useState<string>("Your Venue");
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
            `⚠️  [${pageName.toUpperCase()} CLIENT] No user found, redirecting to sign-in`
          );
          const redirect =
            redirectPath || `/dashboard/${venueId}/${pageName.toLowerCase().replace(/\s+/g, "-")}`;
          router.push(`/sign-in?redirect=${redirect}`);
          return;
        }

        console.info(`🔐 [${pageName.toUpperCase()} CLIENT] Auth check:`, {
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

        console.info(`✅ [${pageName.toUpperCase()} CLIENT] Authorization check:`, {
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

        // Get venue name (from owner check or fetch separately for staff)
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

        // Owner role always takes precedence
        const finalRole = isOwner ? "owner" : roleData?.role || "staff";
        setUserRole(finalRole);

        // Check role-based access if required roles are specified
        if (requiredRoles && requiredRoles.length > 0) {
          const roleHasAccess = requiredRoles.includes(finalRole);
          setHasAccess(isOwner || roleHasAccess);

          if (!isOwner && !roleHasAccess) {
            setAuthError(`This feature requires one of these roles: ${requiredRoles.join(", ")}`);
            setLoading(false);
            return;
          }
        } else {
          setHasAccess(true);
        }

        console.info(`🚀 [${pageName.toUpperCase()} CLIENT] Rendering page:`, {
          venueId,
          userId: currentUser.id,
          finalRole,
          isOwner,
          isStaff,
          hasAccess: !requiredRoles || isOwner || requiredRoles.includes(finalRole),
          timestamp: new Date().toISOString(),
        });

        setLoading(false);
      } catch (error) {
        console.error(`❌ [${pageName.toUpperCase()} CLIENT] Auth error:`, error);
        setAuthError("Failed to verify access");
        setLoading(false);
      }
    }

    checkAuth();
  }, [venueId, pageName, redirectPath, requiredRoles, router]);

  return {
    user,
    userRole,
    venueName,
    loading,
    authError,
    hasAccess,
  };
}

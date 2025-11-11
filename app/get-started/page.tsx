"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

/**
 * Smart redirect page for "Get Started" buttons from external sites (e.g., Wix)
 *
 * Logic:
 * - If signed in and has venues (owner or staff) → redirect to dashboard
 * - If signed in but no venues → redirect to select-plan
 * - If not signed in → redirect to select-plan
 */
export default function GetStartedPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const supabase = supabaseBrowser();

        // Check if user is signed in
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const user = sessionData?.session?.user;

        console.log("[GET-STARTED] Checking auth state", {
          hasUser: !!user,
          userId: user?.id,
          error: sessionError?.message,
        });

        if (!user || sessionError) {
          // Not signed in → redirect to plan page
          console.log("[GET-STARTED] Not signed in, redirecting to select-plan");
          router.push("/select-plan");
          return;
        }

        // User is signed in - check for venues (owner or staff)
        // First check for owner venues
        const { data: ownerVenues, error: ownerError } = await supabase
          .from("venues")
          .select("venue_id")
          .eq("owner_user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        console.log("[GET-STARTED] Owner venues check", {
          hasOwnerVenues: !!ownerVenues,
          venueId: ownerVenues?.venue_id,
          error: ownerError?.message,
        });

        if (ownerVenues && ownerVenues.venue_id) {
          // User has owner venues → redirect to dashboard
          console.log("[GET-STARTED] User has owner venues, redirecting to dashboard", {
            venueId: ownerVenues.venue_id,
          });
          router.push(`/dashboard/${ownerVenues.venue_id}`);
          return;
        }

        // Check for staff roles
        const { data: staffRoles, error: staffError } = await supabase
          .from("user_venue_roles")
          .select("venue_id, role")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        console.log("[GET-STARTED] Staff roles check", {
          hasStaffRoles: !!staffRoles,
          venueId: staffRoles?.venue_id,
          role: staffRoles?.role,
          error: staffError?.message,
        });

        if (staffRoles && staffRoles.venue_id) {
          // User has staff roles → redirect to staff dashboard
          console.log("[GET-STARTED] User has staff roles, redirecting to staff dashboard", {
            venueId: staffRoles.venue_id,
            role: staffRoles.role,
          });
          router.push(`/dashboard/${staffRoles.venue_id}`);
          return;
        }

        // User is signed in but has no venues → redirect to plan page
        console.log("[GET-STARTED] User signed in but no venues, redirecting to select-plan");
        router.push("/select-plan");
      } catch (error) {
        console.error("[GET-STARTED] Error checking auth:", error);
        // On error, redirect to plan page
        router.push("/select-plan");
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
        <p className="text-gray-700">Redirecting...</p>
      </div>
    </div>
  );
}

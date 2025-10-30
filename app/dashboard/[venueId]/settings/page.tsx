import SettingsClientPage from "./page.client";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function SettingsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  logger.info("[SETTINGS PAGE] 🔧 Settings page accessed", { venueId });

  // Fetch ALL data on server-side where cookies work
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    logger.warn("[SETTINGS PAGE] No user session found, redirecting to sign-in");
    redirect("/sign-in?next=" + encodeURIComponent(`/dashboard/${venueId}/settings`));
  }

  logger.info("[SETTINGS PAGE] User authenticated on server", { userId: user.id });

  // Fetch all settings data on server
  const [venueResult, userRoleResult, allVenuesResult, orgResult] = await Promise.all([
    supabase
      .from("venues")
      .select("*")
      .eq("venue_id", venueId)
      .eq("owner_user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_venue_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("venue_id", venueId)
      .maybeSingle(),
    supabase
      .from("venues")
      .select("*")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("venues")
      .select("organization_id")
      .eq("venue_id", venueId)
      .single()
      .then(async (result) => {
        if (result.data?.organization_id) {
          return supabase
            .from("organizations")
            .select("id, subscription_tier, stripe_customer_id, subscription_status, trial_ends_at")
            .eq("id", result.data.organization_id)
            .single();
        }
        return { data: null };
      }),
  ]);

  const venue = venueResult.data;
  const userRole = userRoleResult.data;
  const allVenues = allVenuesResult.data || [];
  const organization = "error" in orgResult ? null : orgResult.data;

  const isOwner = !!venue;
  const isManager = userRole?.role === "manager";

  // If manager but not owner, fetch venue separately
  let finalVenue = venue;
  if (!venue && isManager) {
    const { data: managerVenue } = await supabase
      .from("venues")
      .select("*")
      .eq("venue_id", venueId)
      .single();
    finalVenue = managerVenue;
  }

  if (!finalVenue) {
    logger.warn("[SETTINGS PAGE] User has no access to venue", { userId: user.id, venueId });
    redirect("/dashboard");
  }

  const initialData = {
    user,
    venue: finalVenue,
    venues: allVenues,
    organization,
    isOwner,
    isManager,
    userRole: userRole?.role || (isOwner ? "owner" : "staff"),
  };

  logger.info("[SETTINGS PAGE] Data fetched on server", {
    hasVenue: !!finalVenue,
    userRole: initialData.userRole,
  });

  return <SettingsClientPage venueId={venueId} initialData={initialData} />;
}

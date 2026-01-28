import { createServerSupabaseReadOnly } from "@/lib/supabase";
import { HomePageClient } from "./HomePageClient";
import { redirect } from "next/navigation";

export default async function HomePage() {
  // Get auth state and user plan on server where cookies work
  let isSignedIn = false;
  let userPlan: "starter" | "pro" | "enterprise" | null = null;
  let user = null;
  let primaryVenueId: string | null = null;

  try {
    const supabase = await createServerSupabaseReadOnly();
    const {
      data: { user: authUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (!userError && authUser) {
      isSignedIn = true;
      user = authUser;

      // Determine the user's primary venue (owner first, then staff)
      const { data: ownerVenue } = await supabase
        .from("venues")
        .select("venue_id, organization_id")
        .eq("owner_user_id", authUser.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (ownerVenue?.venue_id) {
        primaryVenueId = ownerVenue.venue_id as string;
      } else {
        const { data: staffVenue } = await supabase
          .from("user_venue_roles")
          .select("venue_id")
          .eq("user_id", authUser.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (staffVenue?.venue_id) {
          primaryVenueId = staffVenue.venue_id as string;
        }
      }

      // Fetch user's plan from the organization linked to their primary venue (if any)
      if (ownerVenue?.organization_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("subscription_tier")
          .eq("id", ownerVenue.organization_id)
          .maybeSingle();

        if (org?.subscription_tier) {
          const tier = org.subscription_tier.toLowerCase();
          const normalizedTier =
            tier === "premium"
              ? "enterprise"
              : tier === "standard" || tier === "professional"
                ? "pro"
                : tier === "basic"
                  ? "starter"
                  : tier;
          userPlan = normalizedTier as "starter" | "pro" | "enterprise";
        }
      }
    }
  } catch (error) {

    // If error, default to not signed in
    isSignedIn = false;
  }

  // If the user is signed in and has a primary venue, send them straight to the dashboard
  // This prevents the home/sign-in UI from flashing before navigation.
  if (isSignedIn && primaryVenueId) {
    return redirect(`/dashboard/${primaryVenueId}`);
  }

  return <HomePageClient initialAuthState={isSignedIn} initialUserPlan={userPlan} />;
}

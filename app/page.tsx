import { createServerSupabaseReadOnly } from "@/lib/supabase";
import { HomePageClient } from "./HomePageClient";

export default async function HomePage() {
  // Get auth state and user plan on server where cookies work
  let isSignedIn = false;
  let userPlan: "starter" | "pro" | "enterprise" | null = null;
  let user = null;

  try {
    const supabase = await createServerSupabaseReadOnly();
    const {
      data: { user: authUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (!userError && authUser) {
      isSignedIn = true;
      user = authUser;

      // Fetch user's venue and plan
      const { data: venues } = await supabase
        .from("venues")
        .select("organization_id")
        .eq("owner_user_id", authUser.id)
        .limit(1);

      if (venues && venues.length > 0) {
        const firstVenue = venues[0];

        // Get subscription tier from organization table
        if (firstVenue?.organization_id) {
          const { data: org } = await supabase
            .from("organizations")
            .select("subscription_tier")
            .eq("id", firstVenue.organization_id)
            .maybeSingle();

          if (org?.subscription_tier) {
            // Normalize old tier names to new ones
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
    }
  } catch (error) {

    // If error, default to not signed in
    isSignedIn = false;
  }

  return <HomePageClient initialAuthState={isSignedIn} initialUserPlan={userPlan} />;
}

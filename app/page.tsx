import { createServerSupabaseReadOnly } from "@/lib/supabase";
import { HomePageClient } from "./HomePageClient";
import { logger } from "@/lib/logger";

export default async function HomePage() {
  // Get auth state and user plan on server where cookies work
  let isSignedIn = false;
  let userPlan: "basic" | "standard" | "premium" | null = null;
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
            userPlan = org.subscription_tier.toLowerCase() as "basic" | "standard" | "premium";
          }
        }
      }
    }
  } catch (error) {
    logger.error("[HOME PAGE] Error fetching user data", { error });
    // If error, default to not signed in
    isSignedIn = false;
  }

  return <HomePageClient initialAuthState={isSignedIn} initialUserPlan={userPlan} />;
}

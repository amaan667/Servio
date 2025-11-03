import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseReadOnly } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerSupabaseReadOnly();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch venues in EXACT same way as all sign-in methods
    const { data: venues, error: venuesError } = await supabase
      .from("venues")
      .select("venue_id, venue_name, created_at, organization_id")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: true });

    if (venuesError) {
      logger.error("[DEBUG MY VENUES] Error fetching venues", { error: venuesError });
      return NextResponse.json({ error: venuesError.message }, { status: 500 });
    }

    // Get organization data for each venue
    const venuesWithOrg = await Promise.all(
      (venues || []).map(async (venue) => {
        if (venue.organization_id) {
          const { data: org } = await supabase
            .from("organizations")
            .select("id, subscription_tier, stripe_customer_id")
            .eq("id", venue.organization_id)
            .maybeSingle();
          return { ...venue, organization: org };
        }
        return { ...venue, organization: null };
      })
    );

    const result = {
      userId,
      venueCount: venues?.length || 0,
      venues: venuesWithOrg,
      firstVenue: venues?.[0]?.venue_id || null,
      firstVenueName: venues?.[0]?.venue_name || null,
      redirectWouldGoTo: venues?.[0]?.venue_id
        ? `/dashboard/${venues[0].venue_id}`
        : "/select-plan",
    };


    return NextResponse.json(result);
  } catch (err) {
    logger.error("[DEBUG MY VENUES] Unexpected error", { error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

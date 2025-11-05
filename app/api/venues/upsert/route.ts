import { NextResponse } from "next/server";
import { createClient, getAuthenticatedUser } from "@/lib/supabase";
import { cache, cacheKeys, cacheTTL } from "@/lib/cache";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { venueId, name, business_type, address, phone, email } = await req.json();

    if (!venueId || !name || !business_type) {
      return NextResponse.json(
        { ok: false, error: "venueId, name, and business_type required" },
        { status: 400 }
      );
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const admin = await createClient();

    // Check if venue exists and user owns it
    const { data: existingVenue } = await admin
      .from("venues")
      .select("id, owner_user_id")
      .eq("venue_id", venueId)
      .maybeSingle();

    if (existingVenue && existingVenue.owner_user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const venueData = {
      venue_id: venueId,
      venue_name: name,
      business_type: business_type.toLowerCase(),
      address: address || null,
      phone: phone || null,
      email: email || null,
      owner_user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    if (existingVenue) {
      // Update existing venue
      const { data, error } = await admin
        .from("venues")
        .update(venueData)
        .eq("id", existingVenue.id)
        .select()
        .single();

      // Invalidate venue cache
      await cache.invalidate(`venue:${venueId}`);

      if (error) throw error;
      return NextResponse.json({ ok: true, venue: data });
    } else {
      // Create new venue
      const newVenueData = {
        ...venueData,
        created_at: new Date().toISOString(),
      };
      const { data, error } = await admin.from("venues").insert(newVenueData).select().single();

      if (error) throw error;
      return NextResponse.json({ ok: true, venue: data });
    }
  } catch (_error) {
    logger.error("[VENUES UPSERT] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      { ok: false, error: _error instanceof Error ? _error.message : "Failed to upsert venue" },
      { status: 500 }
    );
  }
}

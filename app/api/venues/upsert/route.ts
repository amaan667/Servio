import { NextResponse } from "next/server";
import { apiErrors } from '@/lib/api/standard-response';
import { createClient } from "@/lib/supabase";
import { cache, cacheKeys, cacheTTL } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const body = await req.json();
      const { name, business_type, address, phone, email  } = body;
      const finalVenueId = context.venueId || body.venueId;
      const user = context.user;

      if (!finalVenueId || !name || !business_type) {
        return NextResponse.json(
          { ok: false, error: "finalVenueId, name, and business_type required" },
          { status: 400 }
        );
      }

    const admin = await createClient();

    // Check if venue exists and user owns it
    const { data: existingVenue } = await admin
      .from("venues")
      .select("id, owner_user_id")
      .eq("venue_id", finalVenueId)
      .maybeSingle();

    if (existingVenue && existingVenue.owner_user_id !== user.id) {
      return apiErrors.forbidden('Forbidden');
    }

    const venueData = {
      venue_id: finalVenueId,
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
      await cache.invalidate(`venue:${finalVenueId}`);

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
);

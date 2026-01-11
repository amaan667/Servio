import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {

          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { tableId, startAt, endAt, partySize, name, phone } = body;

    // Validate inputs
    if (!startAt || !endAt) {
      return NextResponse.json(
        {

        },
        { status: 400 }
      );
    }

    if (new Date(startAt) >= new Date(endAt)) {
      return NextResponse.json(
        {

        },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        {

        },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // Create reservation
    const { data: reservation, error: reservationError } = await adminSupabase
      .from("reservations")
      .insert({

      .select()
      .single();

    if (reservationError) {
      
      return NextResponse.json(
        {

        },
        { status: 500 }
      );
    }

    return NextResponse.json({

      reservation,

  } catch (_error) {
    
    return NextResponse.json(
      {

      },
      { status: 500 }
    );
  }

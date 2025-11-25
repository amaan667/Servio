import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

export const GET = withUnifiedAuth(
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

      const venueId = context.venueId;
      
      if (!venueId) {
        return NextResponse.json({ ok: false, error: "venueId required" }, { status: 400 });
      }
      
      const admin = await createClient();
      const { data, error } = await admin
        .from("reviews")
        .select("id, order_id, rating, comment, created_at")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, reviews: data });
    } catch (_error) {
      return NextResponse.json(
        { ok: false, error: _error instanceof Error ? _error.message : "Unknown error" },
        { status: 500 }
      );
    }
  }
);

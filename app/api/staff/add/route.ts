import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
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

      const body = await req.json().catch(() => ({}));
      const { name, role } = body || {};

      if (!name) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
      }

      const admin = createAdminClient();
      const { data, error } = await admin
        .from("staff")
        .insert([{ venue_id: context.venueId, name, role: role || "Server" }])
        .select("*");
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      
      return NextResponse.json({ success: true, data: data ?? [] });
    } catch (_e) {
      return NextResponse.json(
        { error: _e instanceof Error ? _e.message : "Unknown error" },
        { status: 500 }
      );
    }
  }
);

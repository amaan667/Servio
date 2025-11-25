import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {

    // CRITICAL: Authentication check
    const { requireAuthForAPI } = await import('@/lib/auth/api');
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // CRITICAL: Rate limiting
    const { rateLimit, RATE_LIMITS } = await import('@/lib/rate-limit');
    const rateLimitResult = await rateLimit(request, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { type, title, description, email, userAgent, timestamp } = body;

    if (!description || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    // Store feedback in database
    const { error } = await supabase.from("feedback").insert({
      type,
      title: title || `${type} submission`,
      description,
      email,
      user_agent: userAgent,
      created_at: timestamp || new Date().toISOString(),
      status: "pending",
    });

    if (error) {
      logger.error("[FEEDBACK] Error storing feedback:", error);
      // Don't fail if database insert fails - log it
    }

    // Log to console for immediate visibility during pilot
    logger.info("[PILOT FEEDBACK]", {
      type,
      title,
      description,
      email,
      timestamp,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[FEEDBACK] Error:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}

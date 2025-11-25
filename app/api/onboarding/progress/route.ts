// Server-side onboarding progress tracking
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireAuthForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    // CRITICAL: Authentication check
    const authResult = await requireAuthForAPI(req);
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: "Unauthorized", message: authResult.error || "Authentication required" },
        { status: 401 }
      );
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const supabase = await createClient();
    const user = authResult.user;
    const { data: progress, error } = await supabase
      .from("onboarding_progress")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      logger.error("[ONBOARDING PROGRESS] Error fetching:", error);
      return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      progress: progress || {
        user_id: user.id,
        current_step: 1,
        completed_steps: [],
        data: {},
      },
    });
  } catch (_error) {
    logger.error("[ONBOARDING PROGRESS] Error:", _error);
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await _request.json();
    const { current_step, completed_steps, data } = body;

    const adminSupabase = await createClient();
    const { error } = await adminSupabase.from("onboarding_progress").upsert({
      user_id: session.user.id,
      current_step: current_step || 1,
      completed_steps: completed_steps || [],
      data: data || {},
      updated_at: new Date().toISOString(),
    });

    if (error) {
      logger.error("[ONBOARDING PROGRESS] Error saving:", error);
      return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    logger.error("[ONBOARDING PROGRESS] Error:", _error);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}

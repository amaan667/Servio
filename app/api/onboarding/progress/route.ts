// Server-side onboarding progress tracking
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const { data: progress, error } = await adminSupabase
      .from("onboarding_progress")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      logger.error("[ONBOARDING PROGRESS] Error fetching:", error);
      return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      progress: progress || {
        user_id: session.user.id,
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

    const adminSupabase = createAdminClient();
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

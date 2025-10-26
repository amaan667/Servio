// AI Assistant - Activity Log Endpoint
// Fetches recent AI assistant actions for a venue

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from '@/lib/logger';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get params
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get("venueId");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!venueId) {
      return NextResponse.json(
        { error: "venueId is required" },
        { status: 400 }
      );
    }

    // Verify user has access to venue
    const { data: roleData } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", venueId)
      .eq("user_id", user.id)
      .single();

    if (!roleData) {
      return NextResponse.json(
        { error: "Access denied to this venue" },
        { status: 403 }
      );
    }

    // Fetch activity log
    const { data: activities, error } = await supabase
      .from("ai_action_audit")
      .select("*")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      activities: activities || [],
    });
  } catch (_error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error("[AI ASSISTANT] Activity fetch error:", { error: errorMessage });
    return NextResponse.json(
      { error: errorMessage || "Failed to fetch activity" },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, title, description, email, userAgent, timestamp } = body;

    if (!description || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

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

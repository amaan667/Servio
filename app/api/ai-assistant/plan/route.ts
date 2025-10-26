// AI Assistant - Plan Endpoint
// Generates an execution plan from user's natural language request

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { planAssistantAction } from "@/lib/ai/assistant-llm";
import { getAssistantContext, getAllSummaries } from "@/lib/ai/context-builders";
import { z } from "zod";
import { logger } from "@/lib/logger";

const PlanRequestSchema = z.object({
  prompt: z.string().min(1).max(500),
  venueId: z.string().min(1), // Accept unknown non-empty string for venue ID
  context: z
    .object({
      page: z.enum(["menu", "inventory", "kds", "orders", "analytics", "general"]).optional(),
    })
    .optional(),
});

export async function POST(_request: NextRequest) {
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

    // Parse request
    const body = await _request.json();
    const { prompt, venueId } = PlanRequestSchema.parse(body);

    // Verify user has access to venue
    let userRole = "owner"; // Default to owner for backward compatibility

    try {
      const { data: roleData } = await supabase
        .from("user_venue_roles")
        .select("role")
        .eq("venue_id", venueId)
        .eq("user_id", user.id)
        .single();

      if (roleData) {
        userRole = roleData.role;
      } else {
        // If no role found, check if user owns the venue
        const { data: venue } = await supabase
          .from("venues")
          .select("owner_user_id")
          .eq("venue_id", venueId)
          .single();

        if (!venue || venue.owner_user_id !== user.id) {
          return NextResponse.json({ error: "Access denied to this venue" }, { status: 403 });
        }
        // User owns venue, allow access
      }
    } catch (tableError) {
      // Table doesn't exist - check if user owns venue
      logger.debug("[AI ASSISTANT] user_venue_roles table check failed, checking venue ownership", {
        extra: { error: tableError instanceof Error ? tableError.message : "Unknown error" },
      });

      const { data: venue } = await supabase
        .from("venues")
        .select("owner_user_id")
        .eq("venue_id", venueId)
        .single();

      if (!venue || venue.owner_user_id !== user.id) {
        return NextResponse.json({ error: "Access denied to this venue" }, { status: 403 });
      }
      // User owns venue, allow access
    }

    // Get assistant context with the determined user role
    const assistantContext = await getAssistantContext(venueId, user.id, userRole);

    // Get data summaries
    const summaries = await getAllSummaries(venueId, assistantContext.features);

    // Plan the action (now returns model used)
    const startTime = Date.now();
    const plan = await planAssistantAction(prompt, assistantContext, summaries as any);
    const executionTime = Date.now() - startTime;

    // Log the planning request (not executed yet) with actual model used
    const { data: auditData } = await supabase
      .from("ai_action_audit")
      .insert({
        venue_id: venueId,
        user_id: user.id,
        user_prompt: prompt,
        intent: plan.intent,
        tool_name: plan.tools[0]?.name || "unknown",
        params:
          plan.tools[0]?.params ||
          {
            /* Empty */
          },
        preview: true,
        executed: false,
        model_version: plan.modelUsed || "gpt-4o-mini", // Track which model was actually used
        execution_time_ms: executionTime,
      })
      .select("id")
      .single();

    return NextResponse.json({
      success: true,
      plan,
      auditId: auditData?.id,
      executionTimeMs: executionTime,
      modelUsed: plan.modelUsed, // Return model info to client
    });
  } catch (_error) {
    logger.error("[AI ASSISTANT] Planning error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });

    if ((_error as any)?.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request format", details: (_error as any)?.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: _error instanceof Error ? _error.message : "Planning failed" },
      { status: 500 }
    );
  }
}

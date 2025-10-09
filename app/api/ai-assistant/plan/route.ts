// AI Assistant - Plan Endpoint
// Generates an execution plan from user's natural language request

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planAssistantAction } from "@/lib/ai/assistant-llm";
import {
  getAssistantContext,
  getAllSummaries,
} from "@/lib/ai/context-builders";
import { z } from "zod";

const PlanRequestSchema = z.object({
  prompt: z.string().min(1).max(500),
  venueId: z.string().min(1), // Accept any non-empty string for venue ID
  context: z
    .object({
      page: z.enum(["menu", "inventory", "kds", "orders", "analytics", "general"]).optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request
    const body = await request.json();
    const { prompt, venueId, context } = PlanRequestSchema.parse(body);

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

    // Get assistant context
    const assistantContext = await getAssistantContext(venueId, user.id);

    // Get data summaries
    const summaries = await getAllSummaries(venueId, assistantContext.features);

    // Plan the action
    const startTime = Date.now();
    const plan = await planAssistantAction(prompt, assistantContext, summaries);
    const executionTime = Date.now() - startTime;

    // Log the planning request (not executed yet)
    const { data: auditData } = await supabase
      .from("ai_action_audit")
      .insert({
        venue_id: venueId,
        user_id: user.id,
        user_prompt: prompt,
        intent: plan.intent,
        tool_name: plan.tools[0]?.name || "unknown",
        params: plan.tools[0]?.params || {},
        preview: true,
        executed: false,
        model_version: "gpt-4o-2024-08-06",
        execution_time_ms: executionTime,
      })
      .select("id")
      .single();

    return NextResponse.json({
      success: true,
      plan,
      auditId: auditData?.id,
      executionTimeMs: executionTime,
    });
  } catch (error: any) {
    console.error("[AI ASSISTANT] Planning error:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request format", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Planning failed" },
      { status: 500 }
    );
  }
}


// AI Assistant - Execute Endpoint
// Executes a planned action after user confirmation

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeTool } from "@/lib/ai/tool-executors";
import { z } from "zod";
import {
  ToolName,
  TOOL_SCHEMAS,
  AIExecutionResult,
  AIPreviewDiff,
  DEFAULT_GUARDRAILS,
} from "@/types/ai-assistant";

const ExecuteRequestSchema = z.object({
  venueId: z.string().min(1), // Accept any non-empty string for venue ID
  toolName: z.string(),
  params: z.record(z.any()),
  preview: z.boolean().default(false),
  auditId: z.string().uuid().optional(), // Link to planning audit
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
    const { venueId, toolName, params, preview, auditId } =
      ExecuteRequestSchema.parse(body);

    // Verify user has access to venue
    let userRole = "owner"; // Default to owner for backward compatibility
    
    try {
      const { data: roleData, error: roleError } = await supabase
        .from("user_venue_roles")
        .select("role")
        .eq("venue_id", venueId)
        .eq("user_id", user.id)
        .single();

      if (roleData && !roleError) {
        userRole = roleData.role;
      } else {
        // If no role found, check if user owns the venue
        const { data: venue } = await supabase
          .from("venues")
          .select("owner_id")
          .eq("venue_id", venueId)
          .single();

        if (!venue || venue.owner_id !== user.id) {
          return NextResponse.json(
            { error: "Access denied to this venue" },
            { status: 403 }
          );
        }
        // User owns venue, allow access
      }
    } catch (tableError) {
      // Table doesn't exist - check if user owns venue
      console.log("[AI ASSISTANT] user_venue_roles table check failed, checking venue ownership:", tableError);
      
      const { data: venue } = await supabase
        .from("venues")
        .select("owner_id")
        .eq("venue_id", venueId)
        .single();

      if (!venue || venue.owner_id !== user.id) {
        return NextResponse.json(
          { error: "Access denied to this venue" },
          { status: 403 }
        );
      }
      // User owns venue, allow access
    }

    // Check RBAC for tool
    const guardrails = DEFAULT_GUARDRAILS[toolName as ToolName];
    if (guardrails?.blockedForRoles?.includes(userRole)) {
      return NextResponse.json(
        { error: `Role '${userRole}' cannot execute '${toolName}'` },
        { status: 403 }
      );
    }

    // Validate params against schema
    const schema = TOOL_SCHEMAS[toolName as ToolName];
    if (!schema) {
      return NextResponse.json(
        { error: `Unknown tool: ${toolName}` },
        { status: 400 }
      );
    }

    const validatedParams = schema.parse(params);

    // Execute or preview
    const startTime = Date.now();
    const result = await executeTool(
      toolName as ToolName,
      validatedParams,
      venueId,
      user.id,
      preview
    );
    const executionTime = Date.now() - startTime;

    // Create audit entry for execution
    if (!preview) {
      const executionResult = result as AIExecutionResult;

      const { data: auditData } = await supabase
        .from("ai_action_audit")
        .insert({
          venue_id: venueId,
          user_id: user.id,
          user_prompt: `Executed: ${toolName}`, // Could link to original prompt
          intent: toolName,
          tool_name: toolName,
          params: validatedParams,
          preview: false,
          executed: true,
          result: executionResult.result,
          model_version: "direct_execution",
          execution_time_ms: executionTime,
          executed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      executionResult.auditId = auditData?.id || "";
    }

    // If preview, create preview audit
    if (preview) {
      const { data: previewAudit } = await supabase
        .from("ai_action_audit")
        .insert({
          venue_id: venueId,
          user_id: user.id,
          user_prompt: `Preview: ${toolName}`,
          intent: toolName,
          tool_name: toolName,
          params: validatedParams,
          preview: true,
          executed: false,
          model_version: "direct_execution",
          execution_time_ms: executionTime,
        })
        .select("id")
        .single();

      const previewResult = result as AIPreviewDiff;
      return NextResponse.json({
        success: true,
        preview: previewResult,
        auditId: previewAudit?.id,
      });
    }

    return NextResponse.json({
      success: true,
      result: result as AIExecutionResult,
      executionTimeMs: executionTime,
    });
  } catch (error: any) {
    console.error("[AI ASSISTANT] Execution error:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid parameters", details: error.errors },
        { status: 400 }
      );
    }

    if (error.code) {
      // AIAssistantError
      const statusMap: Record<string, number> = {
        UNAUTHORIZED: 403,
        INVALID_PARAMS: 400,
        GUARDRAIL_VIOLATION: 400,
        EXECUTION_FAILED: 500,
        RATE_LIMITED: 429,
        TIER_RESTRICTED: 403,
      };

      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: statusMap[error.code] || 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Execution failed" },
      { status: 500 }
    );
  }
}


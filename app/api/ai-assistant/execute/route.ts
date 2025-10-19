export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// AI Assistant - Execute Endpoint
// Executes a planned action after user confirmation

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeTool } from "@/lib/tools";
import { z } from "zod";
import { apiLogger, logger } from '@/lib/logger';
import {
  ToolName,
  TOOL_SCHEMAS,
  AIExecutionResult,
  AIPreviewDiff,
  DEFAULT_GUARDRAILS,
  TOOL_CAPABILITIES,
} from "@/types/ai-assistant";
import { assertVenueCapability, Capability } from "@/lib/auth/permissions";

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
    const { venueId, toolName, params, preview } =
      ExecuteRequestSchema.parse(body);

    // Check user has capability to execute this tool
    const requiredCapability = TOOL_CAPABILITIES[toolName as ToolName] as Capability;
    if (!requiredCapability) {
      return NextResponse.json(
        { error: `Unknown tool: ${toolName}` },
        { status: 400 }
      );
    }

    try {
      // Assert user has the required capability for this venue
      const { role } = await assertVenueCapability(
        user.id,
        venueId,
        requiredCapability
      );
      
      logger.debug(`[AI ASSISTANT] User ${user.id} (${role}) executing ${toolName} (requires ${requiredCapability})`);
    } catch (error: any) {
      if (error.statusCode === 403) {
        return NextResponse.json(
          { error: error.message || "Access denied" },
          { status: 403 }
        );
      }
      throw error;
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
  } catch (error: unknown) {
    logger.error("[AI ASSISTANT] Execution error:", { error: error instanceof Error ? error.message : 'Unknown error' });

    // Type guard for ZodError
    if (error && typeof error === 'object' && 'name' in error && error.name === "ZodError") {
      const zodError = error as unknown as { errors: unknown };
      return NextResponse.json(
        { error: "Invalid parameters", details: zodError.errors },
        { status: 400 }
      );
    }

    // Type guard for AIAssistantError
    if (error && typeof error === 'object' && 'code' in error) {
      const aiError = error as { code: string; message?: string; details?: unknown };
      const statusMap: Record<string, number> = {
        UNAUTHORIZED: 403,
        INVALID_PARAMS: 400,
        GUARDRAIL_VIOLATION: 400,
        EXECUTION_FAILED: 500,
        RATE_LIMITED: 429,
        TIER_RESTRICTED: 403,
      };

      return NextResponse.json(
        { error: aiError.message || "Execution failed", code: aiError.code, details: aiError.details },
        { status: statusMap[aiError.code] || 500 }
      );
    }

    // Generic error
    const errorMessage = error instanceof Error ? error.message : "Execution failed";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


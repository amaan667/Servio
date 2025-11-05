// Simple AI Chat API - No conversation history, direct Q&A
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { planAssistantAction } from "@/lib/ai/assistant-llm";
import { getAssistantContext, getAllSummaries } from "@/lib/ai/context-builders";
import { executeTool } from "@/lib/ai/tool-executors";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
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

    const { message, venueId, currentPage } = await request.json();

    if (!message || !venueId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get context and data summaries
    const context = await getAssistantContext(venueId, user.id);
    const summaries = await getAllSummaries(venueId, context.features);

    // Plan the action
    const plan = await planAssistantAction(message, context, summaries);

    let response = "";
    let navigationInfo = null;

    // Handle direct answer (no tools needed)
    if (plan.directAnswer) {
      response = plan.directAnswer;
    }
    // Execute tools if present
    else if (plan.tools && plan.tools.length > 0) {
      const toolResults = [];

      for (const tool of plan.tools) {
        const result = await executeTool(
          tool.name,
          tool.params,
          venueId,
          user.id,
          false // execute, not preview
        );

        toolResults.push({
          tool: tool.name,
          result,
        });

        // Handle navigation
        if (tool.name === "navigation.go_to_page" && "success" in result && result.success) {
          const resultMessage = "message" in result ? result.message : undefined;
          response = (resultMessage as string | undefined) || plan.reasoning || "Navigating...";

          if ("result" in result && result.result && typeof result.result === "object") {
            const resultObj = result.result as Record<string, unknown>;
            navigationInfo = {
              route: resultObj.route as string,
              page: resultObj.page as string,
            };
          }
        }
      }

      // Generate final response if not navigation
      if (!response) {
        response = plan.reasoning || "Actions completed successfully";
        if (plan.warnings && plan.warnings.length > 0) {
          response += `\n\nNote: ${plan.warnings.join(", ")}`;
        }
      }
    }
    // Fallback
    else {
      response = plan.reasoning || "I'm not sure how to help with that. Could you clarify?";
    }

    return NextResponse.json({
      response,
      navigation: navigationInfo,
    });
  } catch (error) {
    logger.error("[AI SIMPLE CHAT] Error:", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}

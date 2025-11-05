// Simple AI Chat API - No conversation history, direct Q&A
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { planAssistantAction } from "@/lib/ai/assistant-llm";
import { getAssistantContext, getAllSummaries } from "@/lib/ai/context-builders";
import { executeTool } from "@/lib/ai/tool-executors";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let requestBody: { message?: string; venueId?: string; currentPage?: string } = {};

  try {
    logger.info("[AI SIMPLE CHAT] 1. Request received");

    // Get auth token from header
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    logger.info("[AI SIMPLE CHAT] 2. Auth header check:", {
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 10),
      hasToken: !!token,
      tokenLength: token?.length,
    });

    if (!token) {
      logger.error("[AI SIMPLE CHAT] ❌ No auth token in header");
      return NextResponse.json({ error: "Unauthorized - No token provided" }, { status: 401 });
    }

    logger.info("[AI SIMPLE CHAT] 3. Token found, creating Supabase client");

    // Create Supabase client with the token
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    logger.info("[AI SIMPLE CHAT] 4. Verifying token");

    // Verify the token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    logger.info("[AI SIMPLE CHAT] 5. Auth check complete:", {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      authError: authError?.message,
      authErrorName: authError?.name,
    });

    if (!user || authError) {
      logger.error("[AI SIMPLE CHAT] ❌ Auth failed - invalid or expired token:", {
        error: authError?.message,
        errorName: authError?.name,
      });
      return NextResponse.json(
        {
          error: `Authentication failed: ${authError?.message || "Invalid token"}`,
        },
        { status: 401 }
      );
    }

    requestBody = await request.json();
    const { message, venueId, currentPage } = requestBody;

    logger.info("[AI SIMPLE CHAT] 6. Request parsed:", {
      hasMessage: !!message,
      venueId,
      currentPage,
    });

    if (!message || !venueId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    logger.info("[AI SIMPLE CHAT] 7. Getting context and summaries");

    // Get context and data summaries
    const context = await getAssistantContext(venueId, user.id);
    logger.info("[AI SIMPLE CHAT] 8. Context retrieved");

    const summaries = await getAllSummaries(venueId, context.features);
    logger.info("[AI SIMPLE CHAT] 9. Summaries retrieved");

    // Plan the action
    logger.info("[AI SIMPLE CHAT] 10. Planning action for:", message);
    const plan = await planAssistantAction(message, context, summaries);
    logger.info("[AI SIMPLE CHAT] 11. Plan created:", {
      hasDirectAnswer: !!plan.directAnswer,
      toolCount: plan.tools?.length || 0,
    });

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

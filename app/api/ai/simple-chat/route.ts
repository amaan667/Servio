// Simple AI Chat API - With in-session conversation context
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { planAssistantAction } from "@/lib/ai/assistant-llm";
import { getAssistantContext, getAllSummaries } from "@/lib/ai/context-builders";
import { executeTool } from "@/lib/ai/tool-executors";
import { logger } from "@/lib/logger";

// Set max duration to 60 seconds to handle complex operations like translation
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let requestBody: {
    message?: string;
    venueId?: string;
    currentPage?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
  } = {};

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
    const { message, venueId, currentPage, conversationHistory } = requestBody;

    logger.info("[AI SIMPLE CHAT] 6. Request parsed:", {
      hasMessage: !!message,
      venueId,
      currentPage,
      historyLength: conversationHistory?.length || 0,
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

    // Build conversation context from history
    let conversationContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-5); // Last 5 messages
      conversationContext =
        "\n\nRECENT CONVERSATION:\n" +
        recentMessages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    }

    // Plan the action with conversation context
    const enhancedMessage = conversationContext ? `${message}${conversationContext}` : message;

    logger.info("[AI SIMPLE CHAT] 10. Planning action with conversation context");
    const plan = await planAssistantAction(enhancedMessage, context, summaries);
    logger.info("[AI SIMPLE CHAT] 11. Plan created:", {
      hasDirectAnswer: !!plan.directAnswer,
      toolCount: plan.tools?.length || 0,
      tools: plan.tools?.map((t) => ({ name: t.name, preview: t.preview })) || [],
      reasoning: plan.reasoning,
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
      const messages: string[] = [];

      for (const tool of plan.tools) {
        logger.info("[AI SIMPLE CHAT] Executing tool:", {
          toolName: tool.name,
          params: tool.params,
          preview: tool.preview,
        });

        const result = await executeTool(
          tool.name,
          tool.params,
          venueId,
          user.id,
          tool.preview // use the preview flag from the plan
        );

        logger.info("[AI SIMPLE CHAT] Tool result:", {
          toolName: tool.name,
          success: "success" in result ? result.success : "N/A",
          hasResult: "result" in result,
        });

        toolResults.push({
          tool: tool.name,
          result,
        });

        // Build response from tool results
        if ("success" in result && result.success && "result" in result) {
          const resultData = result.result as Record<string, unknown>;

          // Handle navigation (set navigationInfo but don't overwrite messages)
          if (tool.name === "navigation.go_to_page") {
            navigationInfo = {
              route: resultData.route as string,
              page: resultData.page as string,
            };
            // Add navigation message if there are no other messages
            if (messages.length === 0) {
              messages.push((resultData.message as string) || plan.reasoning || "Navigating...");
            }
          }
          // Handle QR code generation
          else if (tool.name.startsWith("qr.")) {
            if (resultData.message) {
              messages.push(resultData.message as string);
            } else if (resultData.qrCode) {
              const qr = resultData.qrCode as Record<string, unknown>;
              messages.push(`QR code generated for ${qr.label}`);
            } else if (resultData.summary) {
              messages.push(resultData.summary as string);
            }

            // Check if there's a navigateTo field for automatic navigation
            if (resultData.navigateTo && typeof resultData.navigateTo === "string") {
              navigationInfo = {
                route: resultData.navigateTo,
                page: "qr-codes",
              };
            }
          }
          // Handle menu operations
          else if (tool.name.startsWith("menu.")) {
            if (resultData.message) {
              messages.push(resultData.message as string);
            }

            // Check if there's a navigateTo field for automatic navigation
            if (resultData.navigateTo && typeof resultData.navigateTo === "string") {
              navigationInfo = {
                route: resultData.navigateTo,
                page: "menu",
              };
            }
          }
          // Handle other tools with message or summary
          else if (resultData.message) {
            messages.push(resultData.message as string);
          } else if (resultData.summary) {
            messages.push(resultData.summary as string);
          }

          // Check for navigateTo on any tool (fallback)
          if (
            !navigationInfo &&
            resultData.navigateTo &&
            typeof resultData.navigateTo === "string"
          ) {
            navigationInfo = {
              route: resultData.navigateTo,
              page: "unknown",
            };
          }
        }
      }

      // Combine all messages
      if (messages.length > 0) {
        response = messages.join(". ");
      } else {
        response = plan.reasoning || "Actions completed successfully";
      }

      if (plan.warnings && plan.warnings.length > 0) {
        response += `\n\nNote: ${plan.warnings.join(", ")}`;
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

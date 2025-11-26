// Simple AI Chat API - With in-session conversation context
import { NextRequest, NextResponse } from "next/server";
import { planAssistantAction } from "@/lib/ai/assistant-llm";
import { getAssistantContext, getAllSummaries } from "@/lib/ai/context-builders";
import { executeTool } from "@/lib/ai/tool-executors";
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Set max duration to 60 seconds to handle complex operations like translation
export const maxDuration = 60;

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const body = await req.json();
      const { message, currentPage, conversationHistory } = body;

      // Structured audit log for AI assistant command entry
      logger.info("[AI SIMPLE CHAT] Command received", {
        venueId: context.venueId,
        userId: context.user?.id,
        currentPage,
        messagePreview: typeof message === "string" ? message.slice(0, 200) : null,
        hasHistory: Array.isArray(conversationHistory) && conversationHistory.length > 0,
      });
      // CRITICAL: Also log to console so it appears in Railway logs
      // eslint-disable-next-line no-console
      console.log("[AI SIMPLE CHAT] Command received:", {
        venueId: context.venueId,
        userId: context.user?.id,
        currentPage,
        messagePreview: typeof message === "string" ? message.slice(0, 200) : null,
      });

      if (!message) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

    // Get context and data summaries with error handling
    let assistantContext;
    let summaries;
    try {
      // eslint-disable-next-line no-console
      console.log("[AI SIMPLE CHAT] Step 1: Getting assistant context...");
      assistantContext = await getAssistantContext(context.venueId, context.user.id);
      // eslint-disable-next-line no-console
      console.log("[AI SIMPLE CHAT] Step 2: Context retrieved successfully", {
        venueId: context.venueId,
        features: assistantContext.features,
      });
      
      // eslint-disable-next-line no-console
      console.log("[AI SIMPLE CHAT] Step 3: Getting data summaries...");
      summaries = await getAllSummaries(context.venueId, assistantContext.features);
      // eslint-disable-next-line no-console
      console.log("[AI SIMPLE CHAT] Step 4: Summaries retrieved", {
        hasMenuSummary: !!summaries.menu,
        hasOrdersSummary: !!summaries.orders,
        hasInventorySummary: !!summaries.inventory,
      });
    } catch (contextError) {
      logger.error("[AI SIMPLE CHAT] Failed to get context", {
        venueId: context.venueId,
        userId: context.user?.id,
        error: contextError instanceof Error ? contextError.message : String(contextError),
        stack: contextError instanceof Error ? contextError.stack : undefined,
      });
      // CRITICAL: Also log to console.error so it appears in Railway logs
      // eslint-disable-next-line no-console
      console.error("[AI SIMPLE CHAT] Failed to get context:", {
        venueId: context.venueId,
        userId: context.user?.id,
        error: contextError instanceof Error ? contextError.message : String(contextError),
        stack: contextError instanceof Error ? contextError.stack : undefined,
      });
      return NextResponse.json(
        { error: "Failed to load assistant context", message: "Please try again" },
        { status: 500 }
      );
    }

    // Build conversation context from history
    // eslint-disable-next-line no-console
    console.log("[AI SIMPLE CHAT] Step 5: Building conversation context...");
    let conversationContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-5); // Last 5 messages
      conversationContext =
        "\n\nRECENT CONVERSATION:\n" +
        recentMessages.map((m: { role: string; content: string }) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
      // eslint-disable-next-line no-console
      console.log("[AI SIMPLE CHAT] Step 5a: Conversation context built", {
        historyLength: conversationHistory.length,
        recentMessagesCount: recentMessages.length,
      });
    } else {
      // eslint-disable-next-line no-console
      console.log("[AI SIMPLE CHAT] Step 5a: No conversation history");
    }

    // Plan the action with conversation context
    const enhancedMessage = conversationContext ? `${message}${conversationContext}` : message;
    // eslint-disable-next-line no-console
    console.log("[AI SIMPLE CHAT] Step 6: Planning assistant action...");
    const plan = await planAssistantAction(enhancedMessage, assistantContext, summaries);
    // eslint-disable-next-line no-console
    console.log("[AI SIMPLE CHAT] Step 7: Plan received", {
      hasDirectAnswer: !!plan.directAnswer,
      toolsCount: plan.tools?.length || 0,
      toolNames: plan.tools?.map((t) => t.name) || [],
      hasWarnings: plan.warnings && plan.warnings.length > 0,
    });

    let response = "";
    let navigationInfo = null;

    // Handle direct answer (no tools needed)
    if (plan.directAnswer) {
      // eslint-disable-next-line no-console
      console.log("[AI SIMPLE CHAT] Step 8: Using direct answer (no tools needed)");
      response = plan.directAnswer;
    }
    // Execute tools if present
    else if (plan.tools && plan.tools.length > 0) {
      // eslint-disable-next-line no-console
      console.log("[AI SIMPLE CHAT] Step 8: Executing tools", {
        toolsCount: plan.tools.length,
      });
      const toolResults = [];
      const messages: string[] = [];

      for (let i = 0; i < plan.tools.length; i++) {
        const tool = plan.tools[i];
        // eslint-disable-next-line no-console
        console.log(`[AI SIMPLE CHAT] Step 8.${i + 1}: Executing tool "${tool.name}"`, {
          toolName: tool.name,
          params: tool.params,
          preview: tool.preview,
        });
        const result = await executeTool(
          tool.name,
          tool.params,
          context.venueId,
          context.user.id,
          tool.preview // use the preview flag from the plan
        );
        // eslint-disable-next-line no-console
        console.log(`[AI SIMPLE CHAT] Step 8.${i + 1}a: Tool "${tool.name}" completed`, {
          success: "success" in result ? result.success : "unknown",
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
      // eslint-disable-next-line no-console
      console.log("[AI SIMPLE CHAT] Step 9: Building response from tool results", {
        messagesCount: messages.length,
        hasNavigation: !!navigationInfo,
      });
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
      // eslint-disable-next-line no-console
      console.log("[AI SIMPLE CHAT] Step 8: Using fallback reasoning");
      response = plan.reasoning || "I'm not sure how to help with that. Could you clarify?";
    }

    // eslint-disable-next-line no-console
    console.log("[AI SIMPLE CHAT] Step 10: Returning response", {
      responseLength: response.length,
      hasNavigation: !!navigationInfo,
    });
    return NextResponse.json({
      response,
      navigation: navigationInfo,
    });
    } catch (_error) {
      // Log the full error for debugging
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      // Check if it's a feature access error (should be handled by withUnifiedAuth, but just in case)
      if (errorMessage.includes("Feature not available") || errorMessage.includes("tier")) {
        return NextResponse.json(
          {
            error: "Feature not available",
            message: errorMessage,
          },
          { status: 403 }
        );
      }
      
      // Check if it's an authentication/authorization error
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      // Log server errors for debugging - use console.error so errors appear in Railway logs
      const errorPayload = {
        venueId: context.venueId,
        userId: context.user?.id,
        message: errorMessage,
        stack: errorStack,
      };
      logger.error("[AI SIMPLE CHAT] Error", errorPayload);
      // CRITICAL: Also log to console.error so it appears in Railway logs
      // eslint-disable-next-line no-console
      console.error("[AI SIMPLE CHAT] Error:", JSON.stringify(errorPayload, null, 2));
      
      // Return generic error in production, detailed in development
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "An unexpected error occurred while processing your request",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    requireFeature: "aiAssistant", // AI Assistant requires Enterprise tier
  }
);

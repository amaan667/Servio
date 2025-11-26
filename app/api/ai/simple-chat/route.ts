// Simple AI Chat API - With in-session conversation context
import { NextRequest, NextResponse } from "next/server";
import { planAssistantAction } from "@/lib/ai/assistant-llm";
import { getAssistantContext, getAllSummaries } from "@/lib/ai/context-builders";
import { executeTool } from "@/lib/ai/tool-executors";
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';

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

      if (!message) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

    // Get context and data summaries
    const assistantContext = await getAssistantContext(context.venueId, context.user.id);
    const summaries = await getAllSummaries(context.venueId, assistantContext.features);

    // Build conversation context from history
    let conversationContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-5); // Last 5 messages
      conversationContext =
        "\n\nRECENT CONVERSATION:\n" +
        recentMessages.map((m: { role: string; content: string }) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    }

    // Plan the action with conversation context
    const enhancedMessage = conversationContext ? `${message}${conversationContext}` : message;
    const plan = await planAssistantAction(enhancedMessage, assistantContext, summaries);

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
        const result = await executeTool(
          tool.name,
          tool.params,
          context.venueId,
          context.user.id,
          tool.preview // use the preview flag from the plan
        );

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
    } catch (_error) {
      return NextResponse.json(
        {
          error: _error instanceof Error ? _error.message : "An unexpected error occurred",
        },
        { status: 500 }
      );
    }
  },
  {
    requireFeature: "aiAssistant", // AI Assistant requires Enterprise tier
  }
);

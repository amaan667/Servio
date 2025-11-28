// Simple AI Chat API - With in-session conversation context
import { NextRequest, NextResponse } from "next/server";
import { planAssistantAction } from "@/lib/ai/assistant-llm";
import { getAssistantContext, getAllSummaries } from "@/lib/ai/context-builders";
import { executeTool } from "@/lib/ai/tool-executors";
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { logger } from "@/lib/logger";
import { isDevelopment } from '@/lib/env';
import { apiErrors } from '@/lib/api/standard-response';

export const runtime = "nodejs";

// Set max duration to 60 seconds to handle complex operations like translation
export const maxDuration = 60;

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    // Log route entry (only in development)
    if (isDevelopment()) {
      logger.debug("[AI SIMPLE CHAT] Route hit", {
        venueId: context?.venueId,
        userId: context?.user?.id,
      });
    }
    
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
      logger.info("[AI SIMPLE CHAT] Command received", {
        venueId: context.venueId,
        currentPage,
        messagePreview: typeof message === "string" ? message.slice(0, 200) : null,
      });

      if (!message) {
        return apiErrors.badRequest('Missing required fields');
      }

    // Get context and data summaries with error handling
    let assistantContext;
    let summaries;
    try {
       
      logger.debug("[AI SIMPLE CHAT] Step 1: Getting assistant context...");
      assistantContext = await getAssistantContext(context.venueId, context.user.id);
      // Context retrieved successfully
      logger.debug({
        venueId: context.venueId,
        features: assistantContext.features,
      });

      logger.debug("[AI SIMPLE CHAT] Step 3: Getting data summaries...");
      summaries = await getAllSummaries(context.venueId, assistantContext.features);
      // Summaries retrieved
      logger.debug({
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
      logger.error("[AI SIMPLE CHAT] Failed to get context:", {
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
     
    logger.debug("[AI SIMPLE CHAT] Step 5: Building conversation context...");
    let conversationContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-5); // Last 5 messages
      conversationContext =
        "\n\nRECENT CONVERSATION:\n" +
        recentMessages.map((m: { role: string; content: string }) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
      // Conversation context built
      logger.debug({
        historyLength: conversationHistory.length,
        recentMessagesCount: recentMessages.length,
      });
    } else {
       
      logger.debug("[AI SIMPLE CHAT] Step 5a: No conversation history");
    }

    // Plan the action with conversation context
    const enhancedMessage = conversationContext ? `${message}${conversationContext}` : message;
     
    logger.debug("[AI SIMPLE CHAT] Step 6: Planning assistant action...");
    const plan = await planAssistantAction(enhancedMessage, assistantContext, summaries);
    // Plan received from AI
    logger.debug({
      hasDirectAnswer: !!plan.directAnswer,
      toolsCount: plan.tools?.length || 0,
      toolNames: plan.tools?.map((t) => t.name) || [],
      hasWarnings: plan.warnings && plan.warnings.length > 0,
    });

    let response = "";
    let navigationInfo = null;

    // Handle direct answer (no tools needed)
    if (plan.directAnswer) {
       
      logger.debug("[AI SIMPLE CHAT] Step 8: Using direct answer (no tools needed)");
      response = plan.directAnswer;
    }
    // Check if we have warnings asking for clarification (should not execute tools)
    else if (plan.warnings && plan.warnings.length > 0 && plan.tools && plan.tools.length === 0) {
      // User needs to provide more information - don't execute anything
       
      logger.debug("[AI SIMPLE CHAT] Step 8: Request needs clarification, no tools to execute");
      response = plan.reasoning || plan.warnings.join(". ");
      if (plan.warnings.length > 0) {
        response += `\n\n${plan.warnings.join("\n")}`;
      }
    }
    // Execute tools if present
    else if (plan.tools && plan.tools.length > 0) {
      // Executing AI tools
      logger.debug({
        toolsCount: plan.tools.length,
      });
      const toolResults = [];
      const messages: string[] = [];

      for (let i = 0; i < plan.tools.length; i++) {
        const tool = plan.tools[i];
        // Executing tool
        logger.debug({
          toolName: tool.name,
          params: tool.params,
          preview: tool.preview,
        });
        
        try {
          const result = await executeTool(
            tool.name,
            tool.params,
            context.venueId,
            context.user.id,
            tool.preview // use the preview flag from the plan
          );
          // Tool execution completed
          logger.debug({
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

              // Only navigate if QR code was actually generated (has qrCode or successful message)
              // Don't navigate if generation failed or params were missing
              const messageStr = typeof resultData.message === "string" ? resultData.message : "";
              if (
                resultData.navigateTo &&
                typeof resultData.navigateTo === "string" &&
                (resultData.qrCode || (messageStr && !messageStr.toLowerCase().includes("required") && !messageStr.toLowerCase().includes("error")))
              ) {
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
        } catch (toolError) {
          // Graceful error handling - log but continue with other tools
          const errorMessage = toolError instanceof Error ? toolError.message : String(toolError);
          logger.error(`[AI SIMPLE CHAT] Tool "${tool.name}" failed:`, {
            toolName: tool.name,
            error: errorMessage,
            venueId: context.venueId,
          });
          
          // Add error message to response but don't fail entire request
          messages.push(`Failed to execute ${tool.name}: ${errorMessage}`);
          
          // For critical tools (create/delete), we might want to stop execution
          // But for now, continue with remaining tools
          if (tool.name.startsWith("menu.create_item") || tool.name.startsWith("menu.delete_item")) {
            // Menu operations are critical - add warning but continue
            messages.push("Note: Some menu operations may have failed. Please check the menu page.");
          }
          
          toolResults.push({
            tool: tool.name,
            result: {
              success: false,
              error: errorMessage,
            },
          });
        }
      }

      // Combine all messages
      // Building response from tool results
      logger.debug({
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
       
      logger.debug("[AI SIMPLE CHAT] Step 8: Using fallback reasoning");
      response = plan.reasoning || "I'm not sure how to help with that. Could you clarify?";
    }

    // Returning response
    logger.debug({
      responseLength: response.length,
      hasNavigation: !!navigationInfo,
    });
    return NextResponse.json({
      response,
      navigation: navigationInfo,
    });
    } catch (_error) {
      // CRITICAL: Log the full error immediately
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[AI SIMPLE CHAT] Uncaught error:", {
        timestamp: new Date().toISOString(),
        errorType: _error?.constructor?.name || typeof _error,
        errorMessage,
        errorStack,
        fullError: JSON.stringify(_error, Object.getOwnPropertyNames(_error), 2),
      });
      
      // Graceful error handling - provide user-friendly messages
      // Check if it's a feature access error (should be handled by withUnifiedAuth, but just in case)
      if (errorMessage.includes("Feature not available") || errorMessage.includes("tier")) {
        return NextResponse.json(
          {
            error: "Feature not available",
            message: "This feature requires a higher subscription tier. Please upgrade to access this functionality.",
            response: "I'm sorry, but this feature isn't available with your current plan. Please upgrade to access it.",
          },
          { status: 403 }
        );
      }
      
      // Check if it's an authentication/authorization error
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: "You don't have permission to perform this action. Please contact your manager if you believe this is an error.",
            response: "I'm sorry, but I don't have permission to perform that action. Please check with your manager.",
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      // Check if it's a validation/guardrail error
      if (errorMessage.includes("GUARDRAIL") || errorMessage.includes("exceeds limit") || errorMessage.includes("violation")) {
        return NextResponse.json(
          {
            error: "Request exceeds safety limits",
            message: errorMessage,
            response: `I can't perform that action because it exceeds safety limits: ${errorMessage}. Please try a smaller change.`,
          },
          { status: 400 }
        );
      }
      
      // Check if it's a context/data error
      if (errorMessage.includes("context") || errorMessage.includes("Failed to load")) {
        return NextResponse.json(
          {
            error: "Context loading failed",
            message: "Unable to load necessary data. Please try again in a moment.",
            response: "I'm having trouble loading the necessary information. Please try again in a moment.",
          },
          { status: 503 }
        );
      }
      
      // Log server errors for debugging
      const errorPayload = {
        venueId: context.venueId,
        userId: context.user?.id,
        message: errorMessage,
        stack: errorStack,
      };
      logger.error("[AI SIMPLE CHAT] Error", errorPayload);
      logger.error("[AI SIMPLE CHAT] Error:", errorPayload);
      
      // Return user-friendly error in production, detailed in development
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: isDevelopment() ? errorMessage : "An unexpected error occurred while processing your request",
          response: isDevelopment() 
            ? `I encountered an error: ${errorMessage}. Please try again or contact support if the issue persists.`
            : "I'm sorry, but I encountered an unexpected error. Please try again in a moment. If the problem persists, please contact support.",
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    requireFeature: "aiAssistant", // AI Assistant requires Enterprise tier
  }
);

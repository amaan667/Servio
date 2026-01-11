// Simple AI Chat API - With in-session conversation context
import { NextRequest, NextResponse } from "next/server";
import { planAssistantAction } from "@/lib/ai/assistant-llm";
import { getAssistantContext, getAllSummaries } from "@/lib/ai/context-builders";
import { executeTool } from "@/lib/ai/tool-executors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { isDevelopment } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

// Set max duration to 60 seconds to handle complex operations like translation
export const maxDuration = 60;

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    // Log route entry (only in development)
    if (isDevelopment()) {
      
    }

    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {

            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // Parse request body with error handling
      let body: { message?: string; currentPage?: string; conversationHistory?: unknown[] };
      try {
        body = await req.json();
      } catch (jsonError) {
        return NextResponse.json(
          {

            response: "I'm sorry, but I couldn't understand your request. Please try again.",
          },
          { status: 400 }
        );
      }

      const { message, currentPage, conversationHistory } = body;

      // Structured audit log for AI assistant command entry

      if (!message) {
        return apiErrors.badRequest("Missing required fields");
      }

      // Get context and data summaries with error handling
      let assistantContext;
      let summaries;
      try {
        
        assistantContext = await getAssistantContext(context.venueId, context.user.id);
        // Context retrieved successfully
        

        
        summaries = await getAllSummaries(context.venueId, assistantContext.features);
        // Summaries retrieved
        
      } catch (contextError) {

        return NextResponse.json(
          { error: "Failed to load assistant context", message: "Please try again" },
          { status: 500 }
        );
      }

      // Build conversation context from history

      
      let conversationContext = "";
      if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        const recentMessages = conversationHistory.slice(-5); // Last 5 messages
        conversationContext =
          "\n\nRECENT CONVERSATION:\n" +
          recentMessages
            .map((m: unknown) => {
              if (typeof m === "object" && m !== null && "role" in m && "content" in m) {
                const msg = m as { role: string; content: string };
                return `${msg.role.toUpperCase()}: ${msg.content}`;
              }
              return "";

            .filter((s) => s.length > 0)
            .join("\n");
        // Conversation context built
        
      } else {
        
      }

      // Plan the action with conversation context
      const enhancedMessage = conversationContext ? `${message}${conversationContext}` : message;

      
      const plan = await planAssistantAction(enhancedMessage, assistantContext, summaries);
      // Plan received from AI
       => t.name) || [],

      let response = "";
      let navigationInfo = null;

      // Handle direct answer (no tools needed)
      if (plan.directAnswer) {
        ");
        response = plan.directAnswer;
      }
      // Check if we have warnings asking for clarification (should not execute tools)
      else if (plan.warnings && plan.warnings.length > 0 && plan.tools && plan.tools.length === 0) {
        // User needs to provide more information - don't execute anything

        
        response = plan.reasoning || plan.warnings.join(". ");
        if (plan.warnings.length > 0) {
          response += `\n\n${plan.warnings.join("\n")}`;
        }
      }
      // Execute tools if present
      else if (plan.tools && plan.tools.length > 0) {
        // Executing AI tools
        
        const toolResults = [];
        const messages: string[] = [];

        for (let i = 0; i < plan.tools.length; i++) {
          const tool = plan.tools[i];
          // Executing tool
          

          try {
            const result = await executeTool(
              tool.name,
              tool.params,
              context.venueId,
              context.user.id,
              tool.preview // use the preview flag from the plan
            );
            // Tool execution completed
            

            toolResults.push({

              result,

            // Build response from tool results
            if ("success" in result && result.success && "result" in result) {
              const resultData = result.result as Record<string, unknown>;

              // Handle navigation (set navigationInfo but don't overwrite messages)
              if (tool.name === "navigation.go_to_page") {
                navigationInfo = {

                };
                // Add navigation message if there are no other messages
                if (messages.length === 0) {
                  messages.push(
                    (resultData.message as string) || plan.reasoning || "Navigating..."
                  );
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
                  (resultData.qrCode ||
                    (messageStr &&
                      !messageStr.toLowerCase().includes("required") &&
                      !messageStr.toLowerCase().includes("error")))
                ) {
                  navigationInfo = {

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

                };
              }
            }
          } catch (toolError) {
            // Graceful error handling - log but continue with other tools
            const errorMessage = toolError instanceof Error ? toolError.message : String(toolError);
            

            // Add error message to response but don't fail entire request
            messages.push(`Failed to execute ${tool.name}: ${errorMessage}`);

            // For critical tools (create/delete), we might want to stop execution
            // But for now, continue with remaining tools
            if (
              tool.name.startsWith("menu.create_item") ||
              tool.name.startsWith("menu.delete_item")
            ) {
              // Menu operations are critical - add warning but continue
              messages.push(
                "Note: Some menu operations may have failed. Please check the menu page."
              );
            }

            toolResults.push({

              },

          }
        }

        // Combine all messages
        // Building response from tool results
        
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

      // Returning response
      
      return NextResponse.json({
        response,

    } catch (_error) {
      // CRITICAL: Log the full error immediately
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      .toISOString(),

        errorMessage,
        errorStack,
        fullError: JSON.stringify(_error, Object.getOwnPropertyNames(_error), 2),

      // Graceful error handling - provide user-friendly messages
      // Check if it's a feature access error (should be handled by withUnifiedAuth, but just in case)
      if (errorMessage.includes("Feature not available") || errorMessage.includes("tier")) {
        return NextResponse.json(
          {

            response:
              "I'm sorry, but this feature isn't available with your current plan. Please upgrade to access it.",
          },
          { status: 403 }
        );
      }

      // Check if it's an authentication/authorization error
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {

            response:
              "I'm sorry, but I don't have permission to perform that action. Please check with your manager.",
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }

      // Check if it's a validation/guardrail error
      if (
        errorMessage.includes("GUARDRAIL") ||
        errorMessage.includes("exceeds limit") ||
        errorMessage.includes("violation")
      ) {
        return NextResponse.json(
          {

            response: `I can't perform that action because it exceeds safety limits: ${errorMessage}. Please try a smaller change.`,
          },
          { status: 400 }
        );
      }

      // Check if it's a context/data error
      if (errorMessage.includes("context") || errorMessage.includes("Failed to load")) {
        return NextResponse.json(
          {

          },
          { status: 503 }
        );
      }

      // Log server errors for debugging
      const errorPayload = {

        fullError: JSON.stringify(_error, Object.getOwnPropertyNames(_error), 2),
      };
      
      

      // Return detailed error for debugging (will be removed later)
      // Include error details in response to help identify the issue
      return NextResponse.json(
        {

          message: errorMessage, // Include actual error message for debugging
          response: `I encountered an error: ${errorMessage}. Please try again or contact support if the issue persists.`,
          // Include debug info in response (temporary for debugging)

            errorMessage,
            ...(errorStack ? { stack: errorStack.substring(0, 500) } : {}), // Limit stack trace length
          },
        },
        { status: 500 }
      );
    }
  },
  {
    requireFeature: "aiAssistant", // AI Assistant requires Enterprise tier
  }
);

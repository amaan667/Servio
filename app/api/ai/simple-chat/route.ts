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
      // Development mode logging
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

      // Parse request body with error handling
      let body: { message?: string; currentPage?: string; conversationHistory?: unknown[] };
      try {
        body = await req.json();
      } catch (jsonError) {
        return NextResponse.json(
          {
            error: "Invalid request body",
            message: "Request body must be valid JSON",
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
      if (
        conversationHistory &&
        Array.isArray(conversationHistory) &&
        conversationHistory.length > 0
      ) {
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
            })
            .filter((s) => s.length > 0)
            .join("\n");
        // Conversation context built
      } else {
        /* Else case handled */
      }

      // Plan the action with conversation context
      const enhancedMessage = conversationContext ? `${message}${conversationContext}` : message;

      const plan = await planAssistantAction(enhancedMessage, assistantContext, summaries);
      // Plan received from AI

      let response = "";
      let navigationInfo = null;

      // Handle direct answer (no tools needed)
      if (plan.directAnswer) {
        response = plan.directAnswer;
      }
      // Check if we have warnings asking for clarification (should not execute tools)
      else if (plan.warnings && plan.warnings.length > 0 && plan.tools && plan.tools.length === 0) {
        // User needs to provide more information - don't execute anything
        // Only show the user-friendly warnings, not the internal reasoning
        response = plan.warnings.join("\n\n");
      }
      // Execute tools if present
      else if (plan.tools && plan.tools.length > 0) {
        // Executing AI tools

        const toolResults = [];
        const messages: string[] = [];

        for (let i = 0; i < plan.tools.length; i++) {
          const tool = plan.tools[i]!;
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
                  messages.push((resultData.message as string) || "Navigating...");
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

        if (messages.length > 0) {
          response = messages.join(". ");
        } else {
          response = "Actions completed successfully";
        }

        if (plan.warnings && plan.warnings.length > 0) {
          response += `\n\nNote: ${plan.warnings.join(", ")}`;
        }
      }
      // Fallback - provide direct response if possible, never show reasoning
      else if (plan.intent) {
        // If there's a directAnswer in the plan, use it (should have been caught above, but check again)
        if (plan.directAnswer) {
          response = plan.directAnswer;
        }
        // If there are warnings, show them as they contain user-facing information
        else if (plan.warnings && plan.warnings.length > 0) {
          response = plan.warnings.join("\n\n");
        }
        // Otherwise, provide a helpful generic response without exposing reasoning
        else {
          response =
            "I'm sorry, I couldn't find the information you're looking for. Please try rephrasing your question or ask me something else.";
        }
      }
      // Ultimate fallback - only show greeting for completely unhandled cases
      else {
        response =
          "Hello! I'm here to help you with your hospitality business. I can assist with menu management, orders, inventory, QR codes, analytics, and more. Try asking me questions like 'How many menu items do I have?', 'What's my revenue today?', or 'Generate a QR code for Table 5'.";
      }

      // Returning response

      return NextResponse.json({
        response,
        navigation: navigationInfo,
      });
    } catch (_error) {
      // Graceful error handling - always return a user-friendly response
      // Never expose raw error types like "Unauthorized" or "Forbidden" to the user
      return NextResponse.json(
        {
          error: "Something went wrong",
          response:
            "I'm sorry, something went wrong while processing your request. Please try again.",
        },
        { status: 500 }
      );
    }
  },
  {
    requireFeature: "aiAssistant",
  }
);

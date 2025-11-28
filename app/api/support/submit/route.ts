import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { apiErrors, success } from "@/lib/api/standard-response";
import { z } from "zod";

const supportSubmissionSchema = z.object({
  type: z.enum(["feature", "bug"]),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  steps: z.string().optional(),
});

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Validate request body
      const body = await req.json();
      const validation = supportSubmissionSchema.safeParse(body);

      if (!validation.success) {
        return apiErrors.badRequest(
          "Invalid request data",
          validation.error.errors
        );
      }

      const { type, subject, description, steps } = validation.data;
      const userEmail = context.user.email || "unknown@example.com";
      const userMetadata = context.user.user_metadata as { full_name?: string } | undefined;
      const userName = userMetadata?.full_name || context.user.email?.split("@")[0] || "User";
      const userId = context.user.id;

      // STEP 3: Generate email content
      const isFeatureRequest = type === "feature";
      const emailSubject = `[${isFeatureRequest ? "FEATURE REQUEST" : "BUG REPORT"}] ${subject}`;
      
      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: ${isFeatureRequest ? "#fbbf24" : "#ef4444"}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
              .field { margin-bottom: 20px; }
              .label { font-weight: bold; color: #374151; margin-bottom: 5px; display: block; }
              .value { background: white; padding: 12px; border-radius: 4px; border: 1px solid #d1d5db; }
              .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2 style="margin: 0;">${isFeatureRequest ? "💡 Feature Request" : "🐛 Bug Report"}</h2>
              </div>
              <div class="content">
                <div class="field">
                  <span class="label">From:</span>
                  <div class="value">${userName} (${userEmail})</div>
                </div>
                <div class="field">
                  <span class="label">User ID:</span>
                  <div class="value">${userId}</div>
                </div>
                <div class="field">
                  <span class="label">${isFeatureRequest ? "Feature Title" : "Bug Title"}:</span>
                  <div class="value">${subject}</div>
                </div>
                <div class="field">
                  <span class="label">${isFeatureRequest ? "Description" : "What happened?"}:</span>
                  <div class="value" style="white-space: pre-wrap;">${description}</div>
                </div>
                ${steps ? `
                <div class="field">
                  <span class="label">Steps to Reproduce:</span>
                  <div class="value" style="white-space: pre-wrap;">${steps}</div>
                </div>
                ` : ""}
                <div class="field">
                  <span class="label">Submitted:</span>
                  <div class="value">${new Date().toLocaleString("en-GB", { dateStyle: "full", timeStyle: "long" })}</div>
                </div>
              </div>
              <div class="footer">
                This ${isFeatureRequest ? "feature request" : "bug report"} was submitted through the Servio platform.
              </div>
            </div>
          </body>
        </html>
      `;

      const emailText = `
${isFeatureRequest ? "FEATURE REQUEST" : "BUG REPORT"}

From: ${userName} (${userEmail})
User ID: ${userId}

${isFeatureRequest ? "Feature Title" : "Bug Title"}: ${subject}

${isFeatureRequest ? "Description" : "What happened?"}:
${description}

${steps ? `Steps to Reproduce:\n${steps}\n` : ""}
Submitted: ${new Date().toLocaleString("en-GB", { dateStyle: "full", timeStyle: "long" })}
      `.trim();

      // STEP 4: Send email
      const emailSent = await sendEmail({
        to: "support@servio.app",
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });

      if (!emailSent) {
        logger.error("[SUPPORT SUBMIT] Failed to send email", {
          type,
          subject,
          userId,
        });
        return apiErrors.internal("Failed to send support request. Please try again.");
      }

      logger.info("[SUPPORT SUBMIT] Support request submitted", {
        type,
        subject,
        userId,
        userEmail,
      });

      // STEP 5: Return success
      return success({
        message: isFeatureRequest
          ? "Feature request submitted successfully"
          : "Bug report submitted successfully",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("[SUPPORT SUBMIT] Error:", {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return apiErrors.internal("Failed to submit support request");
    }
  },
  {
    extractVenueId: async () => null, // Support submissions don't require venue context
  }
);


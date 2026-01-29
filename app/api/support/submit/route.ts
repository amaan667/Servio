import { NextRequest } from "next/server";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { apiErrors, success } from "@/lib/api/standard-response";
import { z } from "zod";

const supportSubmissionSchema = z.object({
  type: z.enum(["feature", "bug"]),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  steps: z.string().optional(),
});

export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const { body, user } = context;
    const { type, subject, description, steps } = body;

    const userEmail = user?.email || "unknown@example.com";
    const userMetadata = user?.user_metadata as { full_name?: string } | undefined;
    const userName = userMetadata?.full_name || user?.email?.split("@")[0] || "User";
    const userId = user?.id || "";

    // Generate email content
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
                ${
                  steps
                    ? `
                <div class="field">
                  <span class="label">Steps to Reproduce:</span>
                  <div class="value" style="white-space: pre-wrap;">${steps}</div>
                </div>
                `
                    : ""
                }
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

    // Send email
    const emailSent = await sendEmail({
      to: "enquiries@servio.uk",
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
    });

    if (!emailSent) {
      return apiErrors.internal("Failed to send support request. Please try again.");
    }

    return success({
      message: isFeatureRequest
        ? "Feature request submitted successfully"
        : "Bug report submitted successfully",
    });
  },
  {
    schema: supportSubmissionSchema,
    requireAuth: true,
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.GENERAL,
  }
);

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { generateReceiptPDF, generateReceiptHTMLForPrint } from "@/lib/pdf/generateReceiptPDF";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";

export async function GET(

  routeContext: { params: Promise<{ orderId: string }> }
) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext) => {
      try {
        // STEP 1: Rate limiting (ALWAYS FIRST)
        const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
        if (!rateLimitResult.success) {
          return NextResponse.json(
            {

              message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
            },
            { status: 429 }
          );
        }

        // STEP 2: Get venueId from context (already verified)
        const venueId = authContext.venueId;

        // STEP 3: Parse request
        const { orderId } = await routeContext.params;

        // STEP 4: Validate inputs
        if (!orderId) {
          return apiErrors.badRequest("orderId is required");
        }

        // STEP 5: Security - Verify order belongs to venue
        // Check if HTML format is requested (for fallback/print)
        const format = req.nextUrl.searchParams.get("format");
        const preferHTML = format === "html";

        const supabase = createAdminClient();

        // Get order details - verify it belongs to authenticated venue
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .eq("venue_id", venueId) // Security: ensure order belongs to authenticated venue
          .single();

        if (orderError || !order) {
          
          return NextResponse.json({ error: "Order not found or access denied" }, { status: 404 });
        }

        // Get logo and detected colors from menu design settings
        const { data: designSettings } = await supabase
          .from("menu_design_settings")
          .select("logo_url, detected_primary_color, primary_color")
          .eq("venue_id", venueId) // Use context.venueId
          .single();

        // Get venue contact info
        const { data: venue } = await supabase
          .from("venues")
          .select("venue_name, email, address")
          .eq("venue_id", venueId) // Use context.venueId
          .single();

        const venueName = venue?.venue_name || "Restaurant";
        const venueAddress = venue?.address || "";
        const venueEmail = venue?.email || "";
        const logoUrl = designSettings?.logo_url || undefined;

        // Use detected primary color from logo (stored when logo was uploaded), fallback to default
        const primaryColor =
          designSettings?.detected_primary_color || designSettings?.primary_color || "#8b5cf6";

        // Calculate VAT (20% UK standard rate)
        const totalAmount = order.total_amount || 0;
        const vatRate = 0.2;
        const vatAmount = totalAmount * (vatRate / (1 + vatRate));
        const subtotal = totalAmount - vatAmount;

        // Prepare receipt data
        const receiptData = {
          venueName,
          venueAddress,
          venueEmail,
          logoUrl,
          primaryColor,

            }) => ({

          ),
          subtotal,
          vatAmount,
          totalAmount,

        };

        // Generate PDF or HTML based on request
        if (preferHTML) {
          // Return HTML for browser printing
          const html = generateReceiptHTMLForPrint(receiptData);
          return new NextResponse(html, {

              "Content-Disposition": `inline; filename="receipt-${receiptData.orderNumber}.html"`,
            },

        }

        // Try to generate actual PDF
        try {
          const pdfBuffer = await generateReceiptPDF(receiptData);

          return new NextResponse(pdfBuffer as unknown as BodyInit, {

              "Content-Disposition": `attachment; filename="receipt-${receiptData.orderNumber}.pdf"`,
              "Cache-Control": "private, max-age=3600",
            },

        } catch (pdfError) {
          // Fallback to HTML if PDF generation fails
          

          const html = generateReceiptHTMLForPrint(receiptData);
          return new NextResponse(html, {

              "Content-Disposition": `attachment; filename="receipt-${receiptData.orderNumber}.html"`,
              "X-PDF-Generation": "failed",
            },

        }
      } catch (_error) {
        const errorMessage =
          _error instanceof Error ? _error.message : "An unexpected error occurred";
        const errorStack = _error instanceof Error ? _error.stack : undefined;

        

        if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
          return NextResponse.json(
            {

            },
            { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
          );
        }

        return NextResponse.json(
          {

            ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
          },
          { status: 500 }
        );
      }
    },
    {
      // Extract venueId from order lookup

            const { createAdminClient } = await import("@/lib/supabase");
            const admin = createAdminClient();
            const { data: order } = await admin
              .from("orders")
              .select("venue_id")
              .eq("id", orderId)
              .single();
            if (order?.venue_id) {
              return order.venue_id;
            }
          }
          return null;
        } catch {
          return null;
        }
      },
    }
  );

  return handler(req, routeContext);
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {

    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI();
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { orderId, phone } = body;
    const finalVenueId = venueId || body.venueId;

    if (!orderId || !phone || !finalVenueId) {
      return NextResponse.json(
        { error: "orderId, phone, and venueId are required" },
        { status: 400 }
      );
    }

    // Validate phone format (basic check)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ""))) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const supabase = await createClient();

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
        .eq("venue_id", finalVenueId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get venue info
    const { data: venue } = await supabase
      .from("venues")
      .select("venue_name")
        .eq("venue_id", finalVenueId)
      .single();

    const venueName = venue?.venue_name || "Restaurant";

    // Generate receipt text message
    const orderNumber = orderId.slice(-6).toUpperCase();
    const total = order.total_amount?.toFixed(2) || "0.00";
    const itemsText = (order.items || [])
      .slice(0, 3)
      .map(
        (item: { item_name?: string; quantity?: number }) =>
          `${item.quantity || 1}x ${item.item_name || "Item"}`
      )
      .join(", ");
    const moreItems = (order.items || []).length > 3 ? ` +${(order.items || []).length - 3} more` : "";

    const receiptUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://servio.app"}/receipts/${orderId}`;
    const receiptText = `Receipt - ${venueName}\nOrder #${orderNumber}\n${itemsText}${moreItems}\nTotal: £${total}\n\nView receipt: ${receiptUrl}\n\nThank you for your order!`;

    // TODO: Integrate with SMS service (Twilio, etc.)
    // For now, we'll log it and mark as sent
    logger.info("[RECEIPTS SMS] Would send SMS:", {
      to: phone,
      message: receiptText,
      orderId,
    });

    // Update order with receipt sent info
    await supabase
      .from("orders")
      .update({
        receipt_sent_at: new Date().toISOString(),
        receipt_channel: "sms",
        receipt_phone: phone,
      })
      .eq("id", orderId);

    // In a real implementation, you would send the SMS here using Twilio or similar
    // Example:
    // const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await twilioClient.messages.create({
    //   body: receiptText,
    //   to: phone,
    //   from: process.env.TWILIO_PHONE_NUMBER
    // });

    return NextResponse.json({
      success: true,
      message: "Receipt SMS sent successfully",
      note: "SMS sending is currently logged. Integrate with Twilio or similar service for production.",
    });
  } catch (error) {
    logger.error("[RECEIPTS SMS] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}



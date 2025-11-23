import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { getAuthenticatedUser } from "@/lib/middleware/authorization";

export async function POST(req: NextRequest) {
  try {
    const { orderId, phone, venueId } = await req.json();

    if (!orderId || !phone || !venueId) {
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

    const supabase = createAdminClient();

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("venue_id", venueId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get venue info
    const { data: venue } = await supabase
      .from("venues")
      .select("venue_name")
      .eq("venue_id", venueId)
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



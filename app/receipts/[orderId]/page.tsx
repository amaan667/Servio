import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase";
import { ReceiptPageClient } from "./ReceiptPageClient";

interface ReceiptPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { orderId } = await params;

  if (!orderId) {
    notFound();
  }

  const supabase = createAdminClient();

  // Get order details
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    notFound();
  }

  // Get venue info - handle RLS gracefully
  let venue = null;
  try {
    const { data: venueData, error: venueError } = await supabase
      .from("venues")
      .select(
        "venue_name, email, address, receipt_logo_url, receipt_footer_text, show_vat_breakdown"
      )
      .eq("venue_id", order.venue_id)
      .maybeSingle();

    if (!venueError && venueData) {
      venue = venueData;
    }
  } catch (error) {
    // Log but continue - venue info is optional for receipt display
  }

  return (
    <ReceiptPageClient
      order={order}
      venueName={venue?.venue_name || "Restaurant"}
      venueEmail={venue?.email}
      venueAddress={venue?.address}
      receiptLogoUrl={venue?.receipt_logo_url}
      receiptFooterText={venue?.receipt_footer_text}
      showVAT={venue?.show_vat_breakdown ?? true}
    />
  );
}

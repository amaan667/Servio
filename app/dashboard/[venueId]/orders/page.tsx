import OrdersClientPage from "./page.client";

export default async function OrdersPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  console.info("📍 [ORDERS PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  return <OrdersClientPage venueId={venueId} />;
}

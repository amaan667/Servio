import OrdersClientPage from "./page.client";

export default async function OrdersPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  return <OrdersClientPage venueId={venueId} />;
}

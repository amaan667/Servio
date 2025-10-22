import BillingClientPage from "./page.client";

export default async function BillingPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  console.info("📍 [BILLING & SUBSCRIPTION PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  return <BillingClientPage venueId={venueId} />;
}

import BillingClientPage from "./page.client";

export default async function BillingPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

    venueId,
    timestamp: new Date().toISOString(),
  });

  return <BillingClientPage venueId={venueId} />;
}

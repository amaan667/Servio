import BillingClientPage from "./page.client";

export default async function BillingPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  return <BillingClientPage venueId={venueId} />;
}

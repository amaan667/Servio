import MenuClientPage from "./page.client";

export default async function MenuPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  console.info("📍 [MENU PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  return <MenuClientPage venueId={venueId} />;
}

import MenuManagementClientPage from "./page.client";

export default async function MenuManagementPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;

  console.info("📍 [MENU MANAGEMENT PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  // Render fully client-side to handle auth and data loading properly
  return <MenuManagementClientPage venueId={venueId} />;
}

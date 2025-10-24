import MenuManagementClientPage from "./page.client";

export default async function MenuManagementPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;

  // Render fully client-side to handle auth and data loading properly
  return <MenuManagementClientPage venueId={venueId} />;
}

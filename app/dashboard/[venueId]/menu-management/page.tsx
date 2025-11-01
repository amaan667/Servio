import MenuManagementClientPage from "./page.client";

// Force dynamic rendering to prevent caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MenuManagementPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;

  // Render fully client-side to handle auth and data loading properly
  return <MenuManagementClientPage venueId={venueId} />;
}

import MenuManagementClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

// Force dynamic rendering to prevent caching
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function MenuManagementPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requirePageAuth(venueId).catch(() => null);

  return <MenuManagementClientPage venueId={venueId} />;
}

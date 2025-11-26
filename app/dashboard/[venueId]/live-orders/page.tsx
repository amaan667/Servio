import LiveOrdersClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function LiveOrdersPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requirePageAuth(venueId);

  return <LiveOrdersClientPage venueId={venueId} />;
}

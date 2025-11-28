import OrdersClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function OrdersPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requirePageAuth(venueId).catch(() => null);

  return <OrdersClientPage venueId={venueId} />;
}

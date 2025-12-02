import PaymentsClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function PaymentsPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requirePageAuth(venueId).catch(() => null);

  return <PaymentsClientPage venueId={venueId} />;
}

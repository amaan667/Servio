import StaffClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function StaffPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check - staff management requires owner or manager
  const auth = await requirePageAuth(venueId, {
    requireRole: ["owner", "manager"],
  }).catch(() => null);

  return (
    <StaffClientPage
      venueId={venueId}
      tier={auth?.tier ?? "starter"}
      role={auth?.role ?? "viewer"}
    />
  );
}

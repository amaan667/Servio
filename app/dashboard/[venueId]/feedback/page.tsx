import FeedbackClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function FeedbackPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check - Customer Feedback is available to all tiers
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Customer feedback is available to all tiers (Starter, Pro, Enterprise)
  const hasFeedbackAccess = auth !== null;

  return (
    <FeedbackClientPage
      venueId={venueId}
      tier={auth?.tier ?? "starter"}
      role={auth?.role ?? "viewer"}
      hasAccess={hasFeedbackAccess}
    />
  );
}

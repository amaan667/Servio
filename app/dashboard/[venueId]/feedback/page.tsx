import FeedbackClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function FeedbackPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check - Customer Feedback requires Pro+ tier
  const auth = await requirePageAuth(venueId, {
    requireFeature: "customerFeedback",
  });

  const hasFeedbackAccess = auth.hasFeatureAccess("customerFeedback");

  return (
    <FeedbackClientPage
      venueId={venueId}
      tier={auth.tier}
      role={auth.role}
      hasAccess={hasFeedbackAccess}
    />
  );
}

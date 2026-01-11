import AichatClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function AichatPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check - AI Assistant requires Enterprise tier
  const auth = await requirePageAuth(venueId, {

  }).catch(() => null);

  const hasAIAccess = auth?.hasFeatureAccess("aiAssistant") ?? false;

  return (
    <AichatClientPage
      venueId={venueId}
      tier={auth?.tier ?? "starter"}
      role={auth?.role ?? "viewer"}
      hasAccess={hasAIAccess}
    />
  );
}

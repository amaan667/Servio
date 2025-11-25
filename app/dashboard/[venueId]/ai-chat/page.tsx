import AichatClientPage from "./page.client";
import { getAuthenticatedUser } from "@/lib/supabase";
import { getPageAuthContext } from "@/lib/auth/unified-auth";
import { redirect } from "next/navigation";

export default async function AichatPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // Server-side auth check
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) {
    redirect("/sign-in");
  }

  // Get tier and access info
  const authContext = await getPageAuthContext(user.id, venueId);
  if (!authContext || !authContext.venueAccess) {
    redirect("/dashboard");
  }

  // Check feature access server-side - AI Assistant requires Enterprise tier
  const hasAIAccess = authContext.hasFeatureAccess("aiAssistant");

  return (
    <AichatClientPage
      venueId={venueId}
      tier={authContext.tier}
      role={authContext.role}
      hasAccess={hasAIAccess}
    />
  );
}

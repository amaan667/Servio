import SettingsClientPage from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { normalizeVenueId } from "@/lib/utils/venueId";

export default async function SettingsPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;
  const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;

  // ── Single auth resolution — handles desktop AND mobile ────────
  const auth = await getAuthContext(venueId);

  if (!auth.isAuthenticated || !auth.userId) {
    // Not authenticated — let the client handle (redirect to login)
    return <SettingsClientPage venueId={venueId} />;
  }

  if (!auth.role || !auth.tier) {
    // Authenticated but no venue access
    return <SettingsClientPage venueId={venueId} />;
  }

  // ── Access check — only owner and manager can access settings ───
  const isOwner = auth.role === "owner";
  const isManager = auth.role === "manager";

  const authInfo = {
    hasAuth: true,
    userId: auth.userId,
    email: auth.email,
    tier: auth.tier,
    role: auth.role,
    venueId: normalizedVenueId,
    timestamp: new Date().toISOString(),
    page: "Settings",
  };

  // ── Fetch display data for the settings UI ─────────────────────
  const supabase = createAdminClient();

  const [venueResult, allVenuesResult] = await Promise.all([
    supabase.from("venues").select("*").eq("venue_id", normalizedVenueId).maybeSingle(),
    supabase
      .from("venues")
      .select("*")
      .eq("owner_user_id", auth.userId)
      .order("created_at", { ascending: true }),
  ]);

  const finalVenue = venueResult.data;
  if (!finalVenue) {
    return <SettingsClientPage venueId={venueId} />;
  }

  // Fetch organisation for billing display
  let organization: {
    id: string;
    subscription_tier?: string;
    stripe_customer_id?: string;
    subscription_status?: string;
    trial_ends_at?: string;
  } | null = null;

  if (finalVenue.organization_id) {
    const { data: orgData } = await supabase
      .from("organizations")
      .select("id, subscription_tier, stripe_customer_id, subscription_status, trial_ends_at")
      .eq("id", finalVenue.organization_id)
      .single();
    organization = orgData || null;
  }

  const initialData = {
    user: { id: auth.userId, email: auth.email ?? undefined, user_metadata: {} },
    venue: finalVenue,
    venues: allVenuesResult.data || [],
    organization,
    isOwner,
    isManager,
    userRole: auth.role,
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <SettingsClientPage venueId={venueId} initialData={initialData} />
    </>
  );
}

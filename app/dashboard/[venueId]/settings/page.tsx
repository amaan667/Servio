import SettingsClientPage from "./page.client";

import { createAdminClient } from "@/lib/supabase";
import {
  requirePageAuth,
  getUserIdFromHeaders,
} from "@/lib/auth/page-auth-helper";
import { resolveVenueAccess } from "@/lib/auth/resolve-access";
import { normalizeVenueId } from "@/lib/utils/venueId";

export default async function SettingsPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;
  const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;

  // ── 1. Try the fast path: middleware set all headers from the RPC ───
  const auth = await requirePageAuth(venueId).catch(() => null);

  let userId = auth?.user?.id ?? null;
  let userEmail = auth?.user?.email ?? undefined;
  let userRole: string | null = auth?.role ?? null;
  let userTier: string | null = auth?.tier ?? null;

  // ── 2. If the middleware RPC did not return full context, resolve
  //       directly from the database (the single source of truth). ────
  if (!userId) {
    // Middleware still sets x-user-id even when the RPC fails.
    userId = await getUserIdFromHeaders();
  }

  if (!userId) {
    // Last resort: read from Supabase server auth
    try {
      const { createServerSupabaseReadOnly } = await import("@/lib/supabase");
      const serverSupabase = await createServerSupabaseReadOnly();
      const {
        data: { user: serverUser },
      } = await serverSupabase.auth.getUser();
      if (serverUser) {
        userId = serverUser.id;
        userEmail = serverUser.email ?? undefined;
      }
    } catch {
      // Not authenticated
    }
  }

  // Not authenticated at all — let the client handle (redirect to login)
  if (!userId) {
    return <SettingsClientPage venueId={venueId} />;
  }

  // When the middleware headers were incomplete (no role/tier), resolve
  // from the DB.  This is NOT a fallback with guessed defaults — it
  // queries venues, user_venue_roles and organizations directly.
  if (!userRole || !userTier) {
    const resolved = await resolveVenueAccess(userId, normalizedVenueId);
    if (resolved) {
      userRole = resolved.role;
      userTier = resolved.tier;
    }
  }

  // If we still cannot determine role/tier the user has no access.
  if (!userRole || !userTier) {
    return <SettingsClientPage venueId={venueId} />;
  }

  // ── 3. Access check — only owner and manager can access settings ───
  const isOwner = userRole === "owner";
  const isManager = userRole === "manager";

  const authInfo = {
    hasAuth: true,
    userId,
    email: userEmail,
    tier: userTier,
    role: userRole,
    venueId: normalizedVenueId,
    timestamp: new Date().toISOString(),
    page: "Settings",
  };

  // ── 4. Fetch display data for the settings UI ─────────────────────
  const supabase = createAdminClient();

  const [venueResult, allVenuesResult] = await Promise.all([
    supabase.from("venues").select("*").eq("venue_id", normalizedVenueId).maybeSingle(),
    supabase
      .from("venues")
      .select("*")
      .eq("owner_user_id", userId)
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
    user: { id: userId, email: userEmail, user_metadata: {} },
    venue: finalVenue,
    venues: allVenuesResult.data || [],
    organization,
    isOwner,
    isManager,
    userRole,
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

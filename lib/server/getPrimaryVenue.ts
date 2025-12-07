export const runtime = "nodejs";
import { createServerSupabase } from "@/lib/supabase";

export async function getPrimaryVenueId(): Promise<string | null> {
  const supa = await createServerSupabase();

  // Use getUser() instead of getSession() for secure authentication
  const { data: { user }, error } = await supa.auth.getUser();
  if (error || !user) return null;

  const { data: venueData } = await supa
    .from("venues")
    .select("venue_id")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  return venueData?.[0]?.venue_id || null;
}

// Middleware Auth - Extract user from headers injected by middleware
// All API routes should use this instead of getAuthUserForAPI()

import { headers } from "next/headers";

export async function getUserFromMiddleware(): Promise<{
  user: { id: string; email: string } | null;
  error: string | null;
}> {
  try {
    const headersList = await headers();
    const userId = headersList.get("x-user-id");
    const userEmail = headersList.get("x-user-email");

    if (!userId) {
      return { user: null, error: "No user in request" };
    }

    return {
      user: {
        id: userId,
        email: userEmail || "",
      },
      error: null,
    };
  } catch (err) {
    return {
      user: null,
      error: err instanceof Error ? err.message : "Auth failed",
    };
  }
}

// For role checking - simplified since middleware already validated auth
export async function getUserRole(venueId: string): Promise<string | null> {
  const { user } = await getUserFromMiddleware();
  if (!user) return null;

  try {
    const { createClient } = await import("@/lib/supabase");
    const supabase = await createClient();

    // Check if owner
    const { data: venueData } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venueId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (venueData) return "owner";

    // Check staff role
    const { data: staffData } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", venueId)
      .eq("user_id", user.id)
      .maybeSingle();

    return staffData?.role || null;
  } catch {
    return null;
  }
}

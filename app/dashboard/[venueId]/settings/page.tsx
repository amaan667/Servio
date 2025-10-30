import SettingsClientPage from "./page.client";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function SettingsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  logger.info("[SETTINGS PAGE] 🔧 Settings page accessed", { venueId });

  // Fetch user and initial data on server-side where cookies work
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    logger.warn("[SETTINGS PAGE] No user session found, redirecting to sign-in");
    redirect("/sign-in?next=" + encodeURIComponent(`/dashboard/${venueId}/settings`));
  }

  logger.info("[SETTINGS PAGE] User authenticated on server", { userId: user.id });

  return <SettingsClientPage venueId={venueId} initialUser={user} />;
}

import SettingsClientPage from "./page.client";
import { logger } from "@/lib/logger";

export default async function SettingsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  logger.info("[SETTINGS PAGE] 🔧 Settings page accessed", { venueId });

  return <SettingsClientPage venueId={venueId} />;
}

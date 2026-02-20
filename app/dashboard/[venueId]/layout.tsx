import { AssistantCommandPalette } from "@/components/ai/assistant-command-palette";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
import { VenueLocaleSync } from "./components/VenueLocaleSync";
import { requireDashboardAccess } from "@/lib/auth/get-auth-context";
import { normalizeVenueId } from "@/lib/utils/venueId";
// import { FeedbackMenu } from "@/components/feedback/FeedbackMenu"; // Temporarily hidden for screenshots

export default async function VenueDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { venueId: string };
}) {
  const { venueId } = params;
  const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;
  await requireDashboardAccess(normalizedVenueId);

  return (
    <>
      <VenueLocaleSync venueId={normalizedVenueId} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <NavigationBreadcrumb venueId={normalizedVenueId} showBackButton={false} />
      </div>
      {children}
      {/* AI Assistant - Global Command Palette (⌘K / Ctrl-K) */}
      <AssistantCommandPalette venueId={normalizedVenueId} showChatHistory={true} />

      {/* Pilot Feedback Menu - Bottom-left expandable */}
      {/* <FeedbackMenu /> Temporarily hidden for screenshots */}
    </>
  );
}

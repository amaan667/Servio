import { AssistantCommandPalette } from "@/components/ai/assistant-command-palette";
import { OfflineDetector } from "@/components/error-handling/OfflineDetector";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
// import { FeedbackMenu } from "@/components/feedback/FeedbackMenu"; // Temporarily hidden for screenshots

export default async function VenueDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <NavigationBreadcrumb venueId={venueId} showBackButton={false} />
      </div>
      {children}
      {/* AI Assistant - Global Command Palette (⌘K / Ctrl-K) */}
      <AssistantCommandPalette venueId={venueId} showChatHistory={true} />

      {/* Offline Detection */}
      <OfflineDetector />

      {/* Pilot Feedback Menu - Bottom-left expandable */}
      {/* <FeedbackMenu /> Temporarily hidden for screenshots */}
    </>
  );
}

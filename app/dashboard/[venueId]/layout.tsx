import { AssistantCommandPalette } from "@/components/ai/assistant-command-palette";
import { OfflineDetector } from "@/components/error-handling/OfflineDetector";
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

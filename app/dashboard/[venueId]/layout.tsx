import { AssistantCommandPalette } from "@/components/ai/assistant-command-palette";
import { OfflineDetector } from "@/components/error-handling/OfflineDetector";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

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

      {/* Pilot Feedback Buttons - Fixed position */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-2 md:bottom-4">
        <FeedbackButton type="bug" />
        <FeedbackButton type="feature" />
      </div>
    </>
  );
}

import { AssistantCommandPalette } from "@/components/ai/assistant-command-palette";

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
    </>
  );
}

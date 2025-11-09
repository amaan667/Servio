"use client";

import { AssistantCommandPalette } from "@/components/ai/assistant-command-palette";
import { OfflineDetector } from "@/components/error-handling/OfflineDetector";
import { FeedbackMenu } from "@/components/feedback/FeedbackMenu";
import { use } from "react";

export default function VenueDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = use(params);

  console.log("[DASHBOARD LAYOUT] Rendering layout for venueId:", venueId);
  console.log("[DASHBOARD LAYOUT] About to render FeedbackMenu");

  return (
    <>
      {children}
      {/* AI Assistant - Global Command Palette (⌘K / Ctrl-K) */}
      <AssistantCommandPalette venueId={venueId} showChatHistory={true} />

      {/* Offline Detection */}
      <OfflineDetector />

      {/* Pilot Feedback Menu - Bottom-left expandable */}
      <FeedbackMenu />
    </>
  );
}

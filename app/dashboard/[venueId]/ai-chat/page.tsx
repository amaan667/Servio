// AI Chat History Page
// Dedicated page for managing AI assistant conversations

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/ai/chat-interface";

interface AIChatPageProps {
  params: Promise<{
    venueId: string;
  }>;
}

export default async function AIChatPage({ params }: AIChatPageProps) {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { venueId } = await params;

  const { data: venue } = await supabase
    .from("venues")
    .select("venue_id, venue_name, owner_user_id")
    .eq("venue_id", venueId)
    .single();

  if (!venue || venue.owner_user_id !== user.id) return null;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">AI Assistant Chat</h1>
        <p className="text-muted-foreground">
          Manage your AI assistant conversations and undo actions
        </p>
      </div>

      <ChatInterface
        venueId={venueId}
        isOpen={true}
        onClose={() => {
          // In a real implementation, this would navigate back
          window.history.back();
        }}
      />
    </div>
  );
}

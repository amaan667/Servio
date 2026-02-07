"use client";

import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { UserRole } from "@/lib/permissions";

export interface ConversationItem {
  id: string;
  venue_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: Array<{
    id: string;
    role: string;
    content: string;
    created_at: string;
  }>;
}

interface AIChatClientPageProps {
  venueId: string;
  tier: string;
  role: string;
  initialConversations: ConversationItem[];
  initialStats?: {
    totalConversations: number;
    totalMessages: number;
    recentConversations: number;
    oldestConversation: string | null;
    newestConversation: string | null;
  };
}

export default function AIChatClientPage({
  venueId,
  tier: _tier,
  role,
  initialConversations = [],
  initialStats,
}: AIChatClientPageProps) {
  const conversations: ConversationItem[] = initialConversations;
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation venueId={venueId} userRole={role as UserRole} userName="User" />

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Assistant</h1>
          <p className="text-lg text-foreground mt-2">
            Get help and insights from your AI assistant
          </p>
        </div>

        {/* Statistics Overview */}
        {initialStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-card text-card-foreground rounded-lg p-4 shadow-sm border">
              <p className="text-sm text-muted-foreground">Total Conversations</p>
              <p className="text-2xl font-bold">{initialStats.totalConversations}</p>
            </div>
            <div className="bg-card text-card-foreground rounded-lg p-4 shadow-sm border">
              <p className="text-sm text-muted-foreground">Total Messages</p>
              <p className="text-2xl font-bold">{initialStats.totalMessages}</p>
            </div>
            <div className="bg-card text-card-foreground rounded-lg p-4 shadow-sm border">
              <p className="text-sm text-muted-foreground">Recent (7 days)</p>
              <p className="text-2xl font-bold">{initialStats.recentConversations}</p>
            </div>
            <div className="bg-card text-card-foreground rounded-lg p-4 shadow-sm border">
              <p className="text-sm text-muted-foreground">Last Activity</p>
              <p className="text-2xl font-bold">
                {initialStats.newestConversation
                  ? new Date(initialStats.newestConversation).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>
        )}

        {/* Conversation History */}
        {conversations.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Recent Conversations</h2>
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="bg-card text-card-foreground rounded-lg p-4 shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{conversation.title || "Untitled Conversation"}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(conversation.created_at).toLocaleDateString()} at{" "}
                        {new Date(conversation.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {conversation.messages?.length || 0} messages
                    </div>
                  </div>
                  {conversation.messages && conversation.messages.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-sm text-muted-foreground truncate">
                        {conversation.messages[conversation.messages.length - 1]?.content || ""}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No Conversations Yet</h2>
            <p className="text-gray-600">Start a conversation with your AI assistant!</p>
          </div>
        )}
      </div>
    </div>
  );
}

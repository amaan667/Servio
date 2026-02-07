import AichatClientPage from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import type { ConversationItem } from "./page.client";

interface ConversationWithMessages {
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

interface ConversationStats {
  totalConversations: number;
  totalMessages: number;
  recentConversations: number;
  oldestConversation: string | null;
  newestConversation: string | null;
}

async function fetchConversationHistory(venueId: string): Promise<{
  conversations: ConversationItem[];
  stats: ConversationStats;
}> {
  const supabase = createAdminClient();

  // Fetch all conversations for this venue
  const { data: conversations, error: conversationsError } = await supabase
    .from("ai_chat_conversations")
    .select(`
      id,
      venue_id,
      user_id,
      title,
      created_at,
      updated_at
    `)
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });

  if (conversationsError) {
    console.error("[AI Chat SSR] Error fetching conversations:", conversationsError);
    return { conversations: [], stats: getEmptyStats() };
  }

  if (!conversations || conversations.length === 0) {
    return { conversations: [], stats: getEmptyStats() };
  }

  // Calculate statistics
  const stats = calculateStats(conversations);

  // For recent conversations (up to 10), fetch their messages for preview
  const recentConversations = conversations.slice(0, 10);
  const conversationIds = recentConversations.map((c) => c.id);

  const { data: messages, error: messagesError } = await supabase
    .from("ai_chat_messages")
    .select("id, conversation_id, role, content, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true });

  if (messagesError) {
    console.error("[AI Chat SSR] Error fetching messages:", messagesError);
    // Continue without messages - stats are still valid
  }

  // Attach messages to conversations
  const conversationsWithMessages = recentConversations.map((conv) => ({
    ...conv,
    messages: messages?.filter((msg) => msg.conversation_id === conv.id) || [],
  }));

  return { conversations: conversationsWithMessages, stats };
}

function calculateStats(conversations: Array<{ created_at: string; updated_at: string }>): ConversationStats {
  const totalConversations = conversations.length;

  // Calculate date ranges
  const dates = conversations.map((c) => new Date(c.created_at).getTime());
  const oldestDate = dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : null;
  const newestDate = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null;

  // Count "recent" conversations (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentCount = conversations.filter((c) => new Date(c.created_at) >= sevenDaysAgo).length;

  return {
    totalConversations,
    totalMessages: 0, // Will be updated when messages are fetched
    recentConversations: recentCount,
    oldestConversation: oldestDate,
    newestConversation: newestDate,
  };
}

function getEmptyStats(): ConversationStats {
  return {
    totalConversations: 0,
    totalMessages: 0,
    recentConversations: 0,
    oldestConversation: null,
    newestConversation: null,
  };
}

export default async function AichatPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Fetch conversation history on server
  let conversationData: { conversations: ConversationItem[]; stats: ConversationStats } = { conversations: [], stats: getEmptyStats() };
  
  try {
    conversationData = await fetchConversationHistory(venueId);
  } catch (error) {
    console.error("[AI Chat SSR] Failed to fetch conversation history:", error);
    // Continue with empty data - client will handle it gracefully
  }

  // Log all auth information for browser console
  const authInfo = {
    hasAuth: !!auth,
    userId: auth?.user?.id,
    email: auth?.user?.email,
    tier: auth?.tier ?? "starter",
    role: auth?.role ?? "viewer",
    venueId: auth?.venueId ?? venueId,
    timestamp: new Date().toISOString(),
    page: "AI Chat",
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <AichatClientPage
        venueId={venueId}
        tier={auth?.tier ?? "starter"}
        role={auth?.role ?? "viewer"}
        initialConversations={conversationData.conversations as ConversationItem[]}
        initialStats={conversationData.stats}
      />
    </>
  );
}

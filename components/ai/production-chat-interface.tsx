// Production AI Chat Interface
// Implements proper conversation management and tool calling

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Send, Bot, User, Wrench } from "lucide-react";
import { logger } from "@/lib/logger";

interface Message {
  id: string;
  authorRole: "system" | "user" | "assistant" | "tool";
  text: string;
  content: unknown;
  callId?: string;
  toolName?: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  venueId: string;
  createdBy: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  venueId: string;
  currentPage?: string;
}

export function ProductionChatInterface({
  isOpen,
  onClose,
  venueId,
  currentPage,
}: ChatInterfaceProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load conversations on open
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, venueId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const response = await fetch(`/api/ai/conversations?venueId=${venueId}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to load conversations");
      }
    } catch (_err) {
      logger.error(
        "[AI CHAT] Failed to load conversations:",
        _err instanceof Error ? _err : { error: String(_err) }
      );
      setError("Failed to load conversations");
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/ai/messages?conversationId=${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to load messages");
      }
    } catch (_err) {
      logger.error(
        "[AI CHAT] Failed to load messages:",
        _err instanceof Error ? _err : { error: String(_err) }
      );
      setError("Failed to load messages");
    }
  };

  const selectConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation);
    loadMessages(conversation.id);
  };

  const createNewConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
    setInput("");
    setError(null);
  };

  const handleSendMessage = async () => {
    const userMessage = input.trim();
    if (!userMessage || loading) return;

    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId,
          conversationId: currentConversation?.id,
          text: userMessage,
          currentPage,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Update conversation list if new conversation was created
        if (!currentConversation) {
          await loadConversations();
          // Find the new conversation
          const newConv = conversations.find((c) => c.id === data.conversationId) || {
            id: data.conversationId,
            title: "New Chat",
          };
          setCurrentConversation(newConv as Conversation);
        }

        // Update messages
        setMessages(data.messages || []);

        // Handle tool results (like navigation)
        if (data.toolResults) {
          for (const toolResult of data.toolResults) {
            if (toolResult.tool === "open_page" && toolResult.result?.url) {
              router.push(toolResult.result.url);
            }
          }
        }

        // Refresh conversations to get updated titles
        await loadConversations();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to send message");
      }
    } catch (_err) {
      logger.error(
        "[AI CHAT] Failed to send message:",
        _err instanceof Error ? _err : { error: String(_err) }
      );
      setError("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageIcon = (role: string) => {
    switch (role) {
      case "user":
        return <User className="h-4 w-4" />;
      case "assistant":
        return <Bot className="h-4 w-4" />;
      case "tool":
        return <Wrench className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>AI Assistant</DialogTitle>
          <DialogDescription>
            Chat with your AI assistant and manage conversation history
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 gap-4 min-h-0">
          {/* Sidebar */}
          <div className="w-80 border-r flex flex-col">
            <div className="p-4 border-b">
              <Button onClick={createNewConversation} className="w-full" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                New Conversation
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {conversations.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No conversations yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Start a new conversation to see it here
                    </p>
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <Card
                      key={conv.id}
                      className={`cursor-pointer transition-colors ${
                        currentConversation?.id === conv.id
                          ? "ring-2 ring-primary bg-primary/5"
                          : "hover:bg-accent"
                      }`}
                      onClick={() => selectConversation(conv)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{conv.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(conv.lastMessageAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {currentConversation && (
              <div className="p-4 border-b">
                <h3 className="font-medium">{currentConversation.title}</h3>
              </div>
            )}

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {currentConversation
                        ? "Start a conversation by typing a message below"
                        : "Select a conversation or start a new one"}
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.authorRole === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.authorRole !== "user" && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          {getMessageIcon(message.authorRole)}
                        </div>
                      )}

                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          message.authorRole === "user"
                            ? "bg-primary text-primary-foreground"
                            : message.authorRole === "tool"
                              ? "bg-blue-50 border border-blue-200"
                              : "bg-muted"
                        }`}
                      >
                        {message.authorRole === "tool" && (
                          <Badge variant="secondary" className="mb-2 text-xs">
                            {message.toolName}
                          </Badge>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </p>
                      </div>

                      {message.authorRole === "user" && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask your AI assistant anything..."
                  disabled={loading}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={loading || !input.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

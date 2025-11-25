"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SimpleChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  venueId: string;
  currentPage?: string;
}

export function SimpleChatInterface({
  isOpen,
  onClose,
  venueId,
  currentPage,
}: SimpleChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    const userMessage = input.trim();
    if (!userMessage || loading) return;

    const newUserMessage: Message = {
      role: "user",
      content: userMessage,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/simple-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          message: userMessage,
          venueId,
          currentPage,
          conversationHistory: messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response || "I processed your request.",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Handle navigation if present
      if (data.navigation?.route) {
        setTimeout(() => {
          router.push(data.navigation.route);
          onClose();
        }, 500);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);

      const errorMsg: Message = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${errorMessage}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
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

  // Get context-aware suggestions based on current page
  const getPageSuggestions = () => {
    const pageName = currentPage?.toLowerCase() || "";

    // QR Codes page
    if (pageName.includes("qr")) {
      return [
        '📱 "Generate a QR code for Table 5"',
        '🔢 "Create QR codes for tables 1-10"',
        '🧾 "Generate a counter QR code"',
        '🖨️ "Download all QR codes as PDF"',
        '📋 "Show me all my QR codes"',
      ];
    }

    // Menu Management page
    if (pageName.includes("menu")) {
      return [
        '🍽️ "Add image to Avocado Toast"',
        '📝 "Create a new menu item"',
        '💰 "Update prices for desserts by 10%"',
        '🖼️ "Which items don\'t have images?"',
        '🌐 "Translate menu to Spanish"',
        '👁️ "Hide all items in Starters category"',
      ];
    }

    // Analytics page
    if (pageName.includes("analytics")) {
      return [
        '💰 "What\'s my revenue today?"',
        '🔥 "Show me top selling items"',
        '📊 "What\'s my busiest day?"',
        '📈 "How is business compared to last week?"',
        '⏰ "What are my peak hours?"',
        '📉 "Which items are selling poorly?"',
      ];
    }

    // Orders/Live Orders page
    if (pageName.includes("order")) {
      return [
        '📦 "Show me pending orders"',
        '✅ "Mark order #123 as completed"',
        '🍕 "What orders are in the kitchen?"',
        '⏱️ "Show me overdue orders"',
        '💵 "Today\'s order total"',
        '📊 "How many orders have we had today?"',
      ];
    }

    // KDS page
    if (pageName.includes("kds")) {
      return [
        '🍳 "Show overdue tickets"',
        '⏰ "What\'s the average prep time?"',
        '🔥 "Which station is busiest?"',
        '📋 "Show tickets for Grill station"',
        '✅ "Mark all ready tickets as complete"',
      ];
    }

    // Inventory page
    if (pageName.includes("inventory")) {
      return [
        '📦 "What items are low in stock?"',
        '➕ "Add 50 units to Tomatoes"',
        '📊 "Show me inventory levels"',
        '🛒 "Generate a purchase order"',
        '⚠️ "Which items need restocking?"',
      ];
    }

    // Tables page
    if (pageName.includes("table")) {
      return [
        '🪑 "Show me available tables"',
        '📋 "What tables have active orders?"',
        '🔢 "Create a new table"',
        '🔀 "Merge tables 5 and 6"',
        '💰 "Show revenue by table today"',
      ];
    }

    // Staff page
    if (pageName.includes("staff")) {
      return [
        '👥 "Show me all staff members"',
        '➕ "Invite a new server"',
        '📊 "Staff performance this week"',
        '🔐 "What are the staff roles?"',
        '⏰ "Who\'s working today?"',
      ];
    }

    // Default suggestions for dashboard or general pages
    return [
      '💰 "What\'s my revenue today?"',
      '🔥 "Show me top selling items"',
      '📊 "What\'s my busiest day?"',
      '🖼️ "Which items don\'t have images?"',
      '📈 "How is business compared to last week?"',
      '🍽️ "Add image to Avocado Toast"',
    ];
  };

  const suggestions = getPageSuggestions();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold">AI Assistant</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8 px-4">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-purple-300" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Servio AI Assistant</h3>
              <p className="text-sm mb-4">
                I can help you with analytics, menu management, orders, and more!
              </p>
              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                <p className="text-xs font-medium text-foreground">Try asking:</p>
                <ul className="text-xs space-y-1">
                  {suggestions.map((suggestion, idx) => (
                    <li
                      key={idx}
                      className="cursor-pointer hover:text-purple-600 transition-colors"
                      onClick={() => setInput(suggestion.replace(/^.*?"/, "").replace(/"$/, ""))}
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === "user" ? "bg-purple-600" : "bg-muted"
                  }`}
                >
                  <p
                    className={`text-sm whitespace-pre-wrap ${
                      msg.role === "user" ? "text-white" : "text-foreground"
                    }`}
                  >
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Error Display */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask me anything..."
              className="resize-none"
              rows={2}
              disabled={loading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={loading || !input.trim()}
              size="lg"
              className="px-6"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

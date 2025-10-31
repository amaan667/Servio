"use client";

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
import { Sparkles, Send, Loader2, CheckCircle } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; result?: unknown }>;
}

interface ChatInterfaceProps {
  venueId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatInterfaceV2({ venueId, isOpen, onClose }: ChatInterfaceProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Welcome message
  const displayMessages =
    messages.length === 0
      ? [
          {
            id: "welcome",
            role: "assistant" as const,
            content:
              "Hi! 👋 I'm your AI assistant. I can help you with:\n\n• Navigation\n• Analytics and sales data\n• Business insights\n\nWhat would you like to know?",
          },
        ]
      : messages;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Add user message
    const newUserMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessage,
    };
    setMessages((prev) => [...prev, newUserMsg]);

    // Prepare assistant message
    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      toolCalls: [],
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: "user", content: userMessage },
          ],
          venueId,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let navigationRoute: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "text") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === "assistant") {
                    lastMsg.content += parsed.content;
                  }
                  return updated;
                });
              } else if (parsed.type === "tool_call") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === "assistant") {
                    lastMsg.toolCalls = lastMsg.toolCalls || [];
                    lastMsg.toolCalls.push({ name: parsed.toolName });
                  }
                  return updated;
                });
              } else if (parsed.type === "tool_result") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === "assistant" && lastMsg.toolCalls) {
                    const tool = lastMsg.toolCalls.find((t) => t.name === parsed.toolName);
                    if (tool) {
                      tool.result = parsed.result;
                      if (parsed.toolName === "navigate" && parsed.result?.route) {
                        navigationRoute = parsed.result.route;
                      }
                    }
                  }
                  return updated;
                });
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }

      // Navigate if needed
      if (navigationRoute) {
        setTimeout(() => {
          router.push(navigationRoute!);
          onClose();
        }, 800);
      }
    } catch (error) {
      console.error("[AI CHAT] Error:", error);
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg.role === "assistant") {
          lastMsg.content = `Sorry, I encountered an error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`;
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 border-b">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <DialogTitle>AI Assistant</DialogTitle>
          </div>
          <DialogDescription>
            Ask me anything about your business. I can help with navigation, analytics, and more.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {displayMessages.map((message) => (
              <Card
                key={message.id}
                className={`${
                  message.role === "user"
                    ? "bg-purple-50 dark:bg-purple-900/20 ml-auto max-w-[80%]"
                    : "bg-white dark:bg-gray-800 mr-auto max-w-[80%]"
                }`}
              >
                <CardContent className="p-4">
                  <Badge
                    variant={message.role === "user" ? "default" : "secondary"}
                    className="mb-2"
                  >
                    {message.role === "user" ? "You" : "AI Assistant"}
                  </Badge>
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>

                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {message.toolCalls.map((tool, idx) => (
                        <div
                          key={idx}
                          className="flex items-center space-x-2 text-xs text-green-600"
                        >
                          <CheckCircle className="h-3 w-3" />
                          <span>✓ Executed: {tool.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <form onSubmit={handleSubmit} className="p-4 border-t">
          <div className="flex items-center space-x-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

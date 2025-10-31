"use client";

import { useChat, type Message } from "ai/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
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

interface ChatInterfaceProps {
  venueId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatInterfaceV2({ venueId, isOpen, onClose }: ChatInterfaceProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    body: {
      venueId,
    },
    onFinish: (message: Message) => {
      // Check if the AI used the navigate tool
      if (message.toolInvocations) {
        const navTool = message.toolInvocations.find(
          (t: any) => t.toolName === "navigate" && t.state === "result"
        );
        if (navTool?.result?.route) {
          setTimeout(() => {
            router.push(navTool.result.route);
            onClose();
          }, 800);
        }
      }
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Add welcome message if empty
  const displayMessages =
    messages.length === 0
      ? [
          {
            id: "welcome",
            role: "assistant" as const,
            content:
              "Hi! 👋 I'm your AI assistant. I can help you with:\n\n• Menu translations\n• Analytics and sales data\n• Navigation\n• Business insights\n\nWhat would you like to know?",
          },
        ]
      : messages;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <DialogTitle>AI Assistant</DialogTitle>
            </div>
          </div>
          <DialogDescription>
            Ask me anything about your menu, orders, analytics, or business. I can help with
            translations, navigation, sales data, and more.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {displayMessages.map((message: Message) => (
              <Card
                key={message.id}
                className={`${
                  message.role === "user"
                    ? "bg-purple-50 dark:bg-purple-900/20 ml-auto max-w-[80%]"
                    : "bg-white dark:bg-gray-800 mr-auto max-w-[80%]"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant={message.role === "user" ? "default" : "secondary"}>
                      {message.role === "user" ? "You" : "AI Assistant"}
                    </Badge>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>

                  {/* Show tool invocations */}
                  {message.toolInvocations && message.toolInvocations.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.toolInvocations.map((tool: any) => (
                        <div
                          key={tool.toolCallId}
                          className="flex items-center space-x-2 text-xs text-green-600 dark:text-green-400"
                        >
                          {tool.state === "result" ? (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              <span>
                                {tool.toolName === "navigate" &&
                                  `Navigating to ${tool.result?.message}`}
                                {tool.toolName === "getAnalytics" && "Retrieved analytics"}
                                {tool.toolName === "translateMenu" && "Translation complete"}
                                {tool.toolName === "updatePrices" && "Prices updated"}
                                {tool.toolName === "toggleAvailability" && "Availability updated"}
                              </span>
                            </>
                          ) : (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Executing {tool.toolName}...</span>
                            </>
                          )}
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
              onChange={handleInputChange}
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

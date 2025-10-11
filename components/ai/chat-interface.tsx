"use client";

// AI Assistant Chat Interface with History and Undo
// Provides a persistent chat experience with conversation history

import { useState, useEffect, useRef, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  Send, 
  MessageSquare, 
  History, 
  Undo2, 
  Check, 
  AlertTriangle,
  Sparkles,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { AIPlanResponse, AIPreviewDiff } from "@/types/ai-assistant";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolName?: string;
  toolParams?: any;
  executionResult?: any;
  auditId?: string;
  createdAt: string;
  canUndo: boolean;
  undoData?: any;
}

interface ChatConversation {
  id: string;
  title: string;
  venueId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  messages: ChatMessage[];
}

interface ChatInterfaceProps {
  venueId: string;
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

export function ChatInterface({ venueId, isOpen, onClose, initialPrompt }: ChatInterfaceProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<AIPlanResponse | null>(null);
  const [previews, setPreviews] = useState<AIPreviewDiff[]>([]);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [executionResults, setExecutionResults] = useState<any[]>([]);
  const [undoing, setUndoing] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversations on mount
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, venueId]);

  // Set initial prompt
  useEffect(() => {
    if (initialPrompt && isOpen) {
      setInput(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadConversations = async () => {
    try {
      console.log("[AI CHAT] Loading conversations for venue:", venueId);
      const response = await fetch(`/api/ai-assistant/conversations?venueId=${venueId}`);
      if (response.ok) {
        const data = await response.json();
        console.log("[AI CHAT] Loaded conversations:", data.conversations);
        setConversations(data.conversations || []);
        
        // If there's a current conversation, load its messages
        if (currentConversation) {
          loadMessages(currentConversation.id);
        } else if (data.conversations && data.conversations.length > 0) {
          // Auto-select the most recent conversation
          const latest = data.conversations[0];
          console.log("[AI CHAT] Auto-selecting latest conversation:", latest.id);
          setCurrentConversation(latest);
          loadMessages(latest.id);
        }
      } else {
        console.error("[AI CHAT] Failed to load conversations:", response.status);
      }
    } catch (error) {
      console.error("[AI CHAT] Failed to load conversations:", error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      console.log("[AI CHAT] Loading messages for conversation:", conversationId);
      const response = await fetch(`/api/ai-assistant/conversations/${conversationId}/messages`);
      if (response.ok) {
        const data = await response.json();
        console.log("[AI CHAT] Loaded messages:", data.messages);
        setMessages(data.messages || []);
      } else {
        console.error("[AI CHAT] Failed to load messages:", response.status);
      }
    } catch (error) {
      console.error("[AI CHAT] Failed to load messages:", error);
    }
  };

  const createNewConversation = async () => {
    try {
      console.log("[AI CHAT] Creating new conversation");
      const response = await fetch("/api/ai-assistant/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId,
          title: "New Conversation",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("[AI CHAT] Created conversation:", data.conversation);
        const newConversation = data.conversation;
        setConversations(prev => [newConversation, ...prev]);
        setCurrentConversation(newConversation);
        setMessages([]);
        setInput("");
        setPlan(null);
        setPreviews([]);
        setError(null);
        setSuccess(false);
        setExecutionResults([]);
      } else {
        console.error("[AI CHAT] Failed to create conversation:", response.status);
      }
    } catch (error) {
      console.error("[AI CHAT] Failed to create conversation:", error);
    }
  };

  const handleSendMessage = async (messageOverride?: string) => {
    const userMessage = messageOverride || input.trim();
    if (!userMessage || loading || executing) return;

    if (!messageOverride) {
      setInput("");
    }

    // Create new conversation if none exists
    if (!currentConversation) {
      await createNewConversation();
      // Wait for conversation to be created, then send message
      setTimeout(() => handleSendMessage(userMessage), 500);
      return;
    }

    // Add user message to chat
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessage,
      createdAt: new Date().toISOString(),
      canUndo: false,
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setError(null);
    setPlan(null);
    setPreviews([]);

    try {
      // Save user message to database
      await fetch(`/api/ai-assistant/conversations/${currentConversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "user",
          content: userMessage,
        }),
      });

      // Plan the action
      const planResponse = await fetch("/api/ai-assistant/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMessage,
          venueId,
          context: { page: "general" },
        }),
      });

      const planData = await planResponse.json();

      if (!planResponse.ok) {
        throw new Error(planData.error || "Planning failed");
      }

      setPlan(planData.plan);

      // Add assistant planning message
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `I'll help you ${planData.plan.intent.toLowerCase()}. ${planData.plan.reasoning}`,
        toolName: planData.plan.tools[0]?.name,
        toolParams: planData.plan.tools[0]?.params,
        createdAt: new Date().toISOString(),
        canUndo: false,
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Save assistant message to database
      await fetch(`/api/ai-assistant/conversations/${currentConversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "assistant",
          content: assistantMsg.content,
          toolName: assistantMsg.toolName,
          toolParams: assistantMsg.toolParams,
        }),
      });

      // Fetch previews
      const previewPromises = planData.plan.tools.map(async (tool: any) => {
        try {
          const res = await fetch("/api/ai-assistant/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              venueId,
              toolName: tool.name,
              params: tool.params,
              preview: true,
            }),
          });
          
          const json = await res.json();
          return res.ok ? json : null;
        } catch (error) {
          console.error(`[AI CHAT] Preview error for ${tool.name}:`, error);
          return null;
        }
      });

      const previewResults = await Promise.all(previewPromises);
      setPreviews(previewResults.map((r) => r?.preview).filter(Boolean));

    } catch (err: any) {
      console.error("[AI CHAT] Error:", err);
      setError(err.message || "Failed to process request");
      
      // Add error message
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `I encountered an error: ${err.message}`,
        createdAt: new Date().toISOString(),
        canUndo: false,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!plan) return;

    setExecuting(true);
    setError(null);

    try {
      const results: any[] = [];
      
      for (const tool of plan.tools) {
        const response = await fetch("/api/ai-assistant/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venueId,
            toolName: tool.name,
            params: tool.params,
            preview: false,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Execution failed");
        }
        
        results.push({ tool: tool.name, result: data.result });

        // Add execution message with undo capability
        const executionMsg: ChatMessage = {
          id: `execution-${Date.now()}-${tool.name}`,
          role: "assistant",
          content: `✅ Executed: ${tool.name.replace(/\./g, " → ")}. ${data.result.message || "Action completed successfully."}`,
          toolName: tool.name,
          toolParams: tool.params,
          executionResult: data.result,
          auditId: data.result.auditId,
          createdAt: new Date().toISOString(),
          canUndo: true,
          undoData: {
            toolName: tool.name,
            params: tool.params,
            result: data.result,
          },
        };

        setMessages(prev => [...prev, executionMsg]);

        // Save execution message to database
        if (!currentConversation) return;
        await fetch(`/api/ai-assistant/conversations/${currentConversation.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "assistant",
            content: executionMsg.content,
            toolName: executionMsg.toolName,
            toolParams: executionMsg.toolParams,
            executionResult: executionMsg.executionResult,
            auditId: executionMsg.auditId,
            canUndo: true,
            undoData: executionMsg.undoData,
          }),
        });
      }

      setSuccess(true);
      setExecutionResults(results);

      // Refresh the page after successful execution
      setTimeout(() => {
        router.refresh();
      }, 2000);

    } catch (err: any) {
      console.error("[AI CHAT] Execution error:", err);
      setError(err.message || "Failed to execute action");
    } finally {
      setExecuting(false);
    }
  };

  const handleUndo = async (messageId: string, undoData: any) => {
    setUndoing(messageId);
    
    try {
      const response = await fetch("/api/ai-assistant/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId,
          messageId,
          undoData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Undo failed");
      }

      // Add undo confirmation message
      const undoMsg: ChatMessage = {
        id: `undo-${Date.now()}`,
        role: "assistant",
        content: `↩️ Undone: ${undoData.toolName.replace(/\./g, " → ")}. The action has been reversed.`,
        createdAt: new Date().toISOString(),
        canUndo: false,
      };

      setMessages(prev => [...prev, undoMsg]);

      // Save undo message to database
      if (!currentConversation) return;
      await fetch(`/api/ai-assistant/conversations/${currentConversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "assistant",
          content: undoMsg.content,
        }),
      });

      // Refresh the page to show undone changes
      setTimeout(() => {
        router.refresh();
      }, 1000);

    } catch (err: any) {
      console.error("[AI CHAT] Undo error:", err);
      setError(err.message || "Failed to undo action");
    } finally {
      setUndoing(null);
    }
  };

  const selectConversation = (conversation: ChatConversation) => {
    setCurrentConversation(conversation);
    setMessages([]);
    setPlan(null);
    setPreviews([]);
    setError(null);
    setSuccess(false);
    setExecutionResults([]);
    loadMessages(conversation.id);
  };

  const formatMessageContent = (content: string) => {
    // Simple formatting for better readability
    return content.split('\n').map((line, index) => (
      <span key={index}>
        {line}
        {index < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 fixed bottom-4 left-4 top-auto">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Servio AI Assistant - Chat History
          </DialogTitle>
          <DialogDescription>
            Chat with your AI assistant and manage conversation history
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Conversations */}
          <div className="w-80 border-r bg-muted/20 flex flex-col">
            <div className="p-4 border-b">
              <Button
                onClick={createNewConversation}
                className="w-full"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Conversation
              </Button>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {conversations.map((conv) => (
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
                          <p className="text-sm font-medium truncate">
                            {conv.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(conv.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        {conv.isActive && (
                          <Badge variant="secondary" className="ml-2">
                            Active
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : message.role === "system"
                          ? "bg-muted text-muted-foreground"
                          : "bg-background border"
                      }`}
                    >
                      <div className="text-sm">
                        {formatMessageContent(message.content)}
                      </div>
                      {message.canUndo && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUndo(message.id, message.undoData)}
                            disabled={undoing === message.id}
                            className="text-xs"
                          >
                            {undoing === message.id ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Undo2 className="h-3 w-3 mr-1" />
                            )}
                            Undo Action
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-background border rounded-lg p-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        Planning your request...
                      </span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Error Display */}
            {error && (
              <div className="mx-4 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">Error</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Plan & Preview */}
            {plan && !success && (
              <div className="mx-4 mb-4 space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-2">Plan</h3>
                  <p className="text-sm text-muted-foreground mb-3">{plan.intent}</p>
                  <p className="text-sm text-muted-foreground">{plan.reasoning}</p>
                </div>

                {previews.map((preview, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold capitalize">
                        {preview.toolName.replace(/\./g, " → ")}
                      </h3>
                      <Badge variant="outline">
                        {preview.impact.itemsAffected} items
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {preview.impact.description}
                    </p>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPlan(null);
                          setPreviews([]);
                        }}
                        disabled={executing}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleExecute}
                        disabled={executing}
                      >
                        {executing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Executing...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Execute
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  placeholder="Ask your AI assistant anything..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={loading || executing}
                  className="flex-1"
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={loading || executing || !input.trim()}
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
      </DialogContent>
    </Dialog>
  );
}

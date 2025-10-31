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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Sparkles } from "lucide-react";
import { ChatInterfaceProps, ChatConversation } from "./types";

// Hooks
import { useChatConversations } from "./hooks/useChatConversations";
import { useChatMessages } from "./hooks/useChatMessages";
import { useChatActions } from "./hooks/useChatActions";

// Components
import { MessageList } from "./components/MessageList";
import { PlanPreview } from "./components/PlanPreview";
import { ChatInput } from "./components/ChatInput";

export function ChatInterface({ venueId, isOpen, onClose, initialPrompt }: ChatInterfaceProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [welcomeShown, setWelcomeShown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    conversations,
    currentConversation,
    setCurrentConversation,
    loadConversations,
    createNewConversation,
    deleteConversation,
  } = useChatConversations(venueId, isOpen);

  const { messages, loadMessages, addMessage, updateMessage, clearMessages } = useChatMessages();

  const {
    loading,
    plan,
    previews,
    executing,
    error: actionError,
    success: actionSuccess,
    executionResults,
    undoing,
    sendMessage,
    executePlan,
    undoAction,
    setError: setActionError,
    setSuccess: setActionSuccess,
  } = useChatActions(venueId);

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

  // Focus input on open and show welcome message
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);

      // Show welcome message on first open
      if (!welcomeShown && messages.length === 0) {
        const welcomeMessage = {
          id: `welcome-${Date.now()}`,
          role: "assistant" as const,
          content:
            "Hi! 👋 I'm your AI assistant. I can help you with:\n\n• Menu translations\n• Analytics and sales data\n• Navigation\n• Business insights\n\nWhat would you like to know?",
          createdAt: new Date().toISOString(),
          canUndo: false,
        };
        addMessage(welcomeMessage);
        setWelcomeShown(true);
      }
    }
  }, [isOpen, welcomeShown, messages.length]);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation.id);
    } else {
      clearMessages();
    }
  }, [currentConversation]);

  // Handle new conversation
  const handleCreateNewConversation = async () => {
    try {
      const newConv = await createNewConversation();
      await loadMessages(newConv.id);
      setInput("");
      return newConv;
    } catch (error) {
      // If database tables don't exist, work in memory-only mode
      console.warn("[AI CHAT] Failed to create conversation, using memory-only mode:", error);
      return {
        id: `temp-conv-${Date.now()}`,
        venueId,
        userId: "anonymous",
        title: "New Chat",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const messageText = input.trim();
    setInput("");
    setError(null);

    // Ensure we have a conversation
    let conv = currentConversation;
    if (!conv) {
      conv = await handleCreateNewConversation();
      setCurrentConversation(conv);
    }

    // Add user message immediately so it appears in chat
    const userMessage = {
      id: `temp-user-${Date.now()}`,
      role: "user" as const,
      content: messageText,
      createdAt: new Date().toISOString(),
      canUndo: false,
    };
    addMessage(userMessage);
    console.log("[AI CHAT] Added user message:", messageText);

    // Send to AI and get response
    try {
      if (!conv) return;

      console.log("[AI CHAT] Sending to AI...");
      const aiPlan = await sendMessage(conv.id, messageText);
      console.log("[AI CHAT] Got AI response:", aiPlan);

      // Add AI response message with explanation
      if (aiPlan) {
        // Build response content from reasoning and description
        let responseContent = "";

        if (aiPlan.reasoning) {
          responseContent = aiPlan.reasoning;
        } else if (aiPlan.description) {
          responseContent = aiPlan.description;
        } else {
          responseContent = "I understand. How can I help you with that?";
        }

        // If there are actions to execute, mention them
        if (aiPlan.actions && aiPlan.actions.length > 0) {
          responseContent +=
            "\n\nI can execute this for you. See the preview below and click 'Execute' when ready.";
        }

        const aiMessage = {
          id: `temp-ai-${Date.now()}`,
          role: "assistant" as const,
          content: responseContent,
          createdAt: new Date().toISOString(),
          canUndo: false,
        };
        addMessage(aiMessage);
        console.log("[AI CHAT] Added AI message");
      } else {
        console.warn("[AI CHAT] No AI response received");
        addMessage({
          id: `temp-no-response-${Date.now()}`,
          role: "assistant" as const,
          content: "I didn't quite understand that. Could you rephrase your question?",
          createdAt: new Date().toISOString(),
          canUndo: false,
        });
      }

      // The PlanPreview component will show action preview if there are actions to execute
    } catch (error) {
      console.error("[AI CHAT] Error:", error);
      const errorMsg = (error as any)?.message || "Unknown error";
      setError(errorMsg);

      // Add error message
      addMessage({
        id: `temp-error-${Date.now()}`,
        role: "assistant" as const,
        content: `Sorry, I encountered an error: ${errorMsg}`,
        createdAt: new Date().toISOString(),
        canUndo: false,
      });
    }
  };

  // Handle execute plan
  const handleExecutePlan = async () => {
    if (!currentConversation || !plan) return;

    try {
      await executePlan(currentConversation.id);

      // Add assistant message with execution result
      const assistantMessage = {
        id: `temp-${Date.now()}`,
        role: "assistant" as const,
        content: "Plan executed successfully!",
        executionResult: executionResults,
        createdAt: new Date().toISOString(),
        canUndo: false,
      };
      addMessage(assistantMessage);
    } catch (_error) {
      setError((error as any).message);
    }
  };

  // Handle undo
  const handleUndo = async (messageId: string, auditId: string) => {
    try {
      await undoAction(messageId, auditId);

      // Update message to mark as undone
      updateMessage(messageId, {
        executionResult: null,
        canUndo: false,
      });
    } catch (_error) {
      setError((error as any).message);
    }
  };

  // Handle close
  const handleClose = () => {
    setInput("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
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

        <div className="flex-1 flex flex-col overflow-hidden">
          {(error || actionError) && (
            <Alert variant="destructive" className="m-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error || actionError}</AlertDescription>
            </Alert>
          )}

          <MessageList messages={messages} undoing={undoing || ""} onUndo={handleUndo} />

          <div ref={messagesEndRef} />

          <PlanPreview
            plan={plan}
            previews={previews}
            executing={executing}
            onExecute={handleExecutePlan}
          />

          <ChatInput
            input={input}
            loading={loading}
            disabled={executing}
            onInputChange={setInput}
            onSend={handleSendMessage}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

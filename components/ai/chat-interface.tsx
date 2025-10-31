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

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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
    } catch (_error) {
      setError((error as any).message);
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const messageText = input.trim();
    setInput("");

    // Ensure we have a conversation
    let conv = currentConversation;
    if (!conv) {
      try {
        conv = await createNewConversation();
      } catch (_error) {
        setError((error as any).message);
        return;
      }
    }

    // Add user message
    const userMessage = {
      id: `temp-user-${Date.now()}`,
      role: "user" as const,
      content: messageText,
      createdAt: new Date().toISOString(),
      canUndo: false,
    };
    addMessage(userMessage);

    // Send to AI and get response
    try {
      if (!conv) return;
      const aiPlan = await sendMessage(conv.id, messageText);

      // Add AI response message
      // The plan response contains the AI's answer
      if (aiPlan) {
        const aiMessage = {
          id: `temp-ai-${Date.now()}`,
          role: "assistant" as const,
          content:
            aiPlan.reasoning || aiPlan.description || "I understand. How can I help you with that?",
          createdAt: new Date().toISOString(),
          canUndo: false,
        };
        addMessage(aiMessage);
      }
    } catch (_error) {
      setError((error as any).message);
      // Add error message
      addMessage({
        id: `temp-error-${Date.now()}`,
        role: "assistant" as const,
        content: "Sorry, I encountered an error. Please try again.",
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

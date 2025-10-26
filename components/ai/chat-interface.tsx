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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Sparkles, History } from "lucide-react";
import { ChatInterfaceProps } from './types';

// Hooks
import { useChatConversations } from './hooks/useChatConversations';
import { useChatMessages } from './hooks/useChatMessages';
import { useChatActions } from './hooks/useChatActions';

// Components
import { ConversationList } from './components/ConversationList';
import { MessageList } from './components/MessageList';
import { PlanPreview } from './components/PlanPreview';
import { ChatInput } from './components/ChatInput';

export function ChatInterface({ venueId, isOpen, onClose, initialPrompt }: ChatInterfaceProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");
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

  const {
    messages,
    loadMessages,
    addMessage,
    updateMessage,
    clearMessages,
  } = useChatMessages();

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

  // Handle conversation selection
  const handleSelectConversation = async (conversation: unknown) => {
    setCurrentConversation(conversation);
    await loadMessages(conversation.id);
    setActiveTab("chat");
  };

  // Handle new conversation
  const handleCreateNewConversation = async () => {
    try {
      const newConv = await createNewConversation();
      await loadMessages(newConv.id);
      setActiveTab("chat");
      setInput("");
    } catch (_error) {
      setError(error.message);
    }
  };

  // Handle delete conversation
  const handleDeleteConversation = async (conversationId: string) => {
    if (!window.confirm("Are you sure you want to delete this conversation?")) {
      return;
    }
    
    try {
      await deleteConversation(conversationId);
      setActiveTab("chat");
    } catch (_error) {
      setError(error.message);
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
        setError(error.message);
        return;
      }
    }

    // Add user message
    const userMessage = {
      id: `temp-${Date.now()}`,
      role: "user" as const,
      content: messageText,
      createdAt: new Date().toISOString(),
      canUndo: false,
    };
    addMessage(userMessage);

    // Send to AI
    try {
      await sendMessage(conv.id, messageText);
    } catch (_error) {
      setError(error.message);
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
      setError(error.message);
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
      setError(error.message);
    }
  };

  // Handle close
  const handleClose = () => {
    setInput("");
    setActiveTab("chat");
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
            Ask me anything about your menu, orders, or business. I can help you manage your venue.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as unknown)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4">
            <TabsTrigger value="chat" className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4" />
              <span>Chat</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <History className="h-4 w-4" />
              <span>History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
            {(error || actionError) && (
              <Alert variant="destructive" className="m-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error || actionError}</AlertDescription>
              </Alert>
            )}

            <MessageList
              messages={messages}
              undoing={undoing || ""}
              onUndo={handleUndo}
            />

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
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-hidden m-0 p-0">
            <ConversationList
              conversations={conversations}
              currentConversation={currentConversation}
              onSelectConversation={handleSelectConversation}
              onCreateNew={handleCreateNewConversation}
              onDelete={handleDeleteConversation}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { ChatConversation } from '../types';

export function useChatConversations(venueId: string, isOpen: boolean) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ChatConversation | null>(null);

  const loadConversations = async () => {
    try {
      console.debug("[AI CHAT] Loading conversations for venue:", venueId);
      const response = await fetch(`/api/ai-assistant/conversations?venueId=${venueId}`);
      console.debug("[AI CHAT] Response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.debug("[AI CHAT] Loaded conversations:", data.conversations);
        console.debug("[AI CHAT] Number of conversations:", data.conversations?.length || 0);
        setConversations(data.conversations || []);
        
        if (!currentConversation && data.conversations && data.conversations.length > 0) {
          const latest = data.conversations[0];
          console.debug("[AI CHAT] Auto-selecting latest conversation:", latest.id);
          setCurrentConversation(latest);
        }
      } else {
        const errorData = await response.text();
        console.error("[AI CHAT] Failed to load conversations:", response.status, errorData);
        
        try {
          const errorJson = JSON.parse(errorData);
          if (errorJson.migrationNeeded) {
            console.error("[AI CHAT] Migration needed:", errorJson.instructions);
            throw new Error(`Database migration required. Please run the migration script or contact support.`);
          } else {
            throw new Error(errorJson.error || "Failed to load conversations");
          }
        } catch (e) {
          throw new Error("Failed to load conversations");
        }
      }
    } catch (error: unknown) {
      console.error("[AI CHAT] Error loading conversations:", error);
      throw error;
    }
  };

  const createNewConversation = async () => {
    try {
      const response = await fetch('/api/ai-assistant/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId }),
      });

      if (response.ok) {
        const data = await response.json();
        const newConversation = data.conversation;
        setConversations(prev => [newConversation, ...prev]);
        setCurrentConversation(newConversation);
        return newConversation;
      } else {
        throw new Error("Failed to create conversation");
      }
    } catch (error: unknown) {
      console.error("[AI CHAT] Error creating conversation:", error);
      throw error;
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/ai-assistant/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        if (currentConversation?.id === conversationId) {
          setCurrentConversation(null);
        }
      } else {
        throw new Error("Failed to delete conversation");
      }
    } catch (error: unknown) {
      console.error("[AI CHAT] Error deleting conversation:", error);
      throw error;
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, venueId]);

  return {
    conversations,
    currentConversation,
    setCurrentConversation,
    loadConversations,
    createNewConversation,
    deleteConversation,
  };
}


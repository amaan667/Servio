import { useState, useEffect } from 'react';
import { ChatConversation } from '../types';

export function useChatConversations(venueId: string, isOpen: boolean) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ChatConversation | null>(null);

  const loadConversations = async () => {
    try {

      const response = await fetch(`/api/ai-assistant/conversations?venueId=${venueId}`);

      if (response.ok) {
        const data = await response.json();

        setConversations(data.conversations || []);
        
        if (!currentConversation && data.conversations && data.conversations.length > 0) {
          const latest = data.conversations[0];

          setCurrentConversation(latest);
        }
      } else {
        const errorData = await response.text();

        try {
          const errorJson = JSON.parse(errorData);
          if (errorJson.migrationNeeded) {

            throw new Error(`Database migration required. Please run the migration script or contact support.`);
          } else {
            throw new Error(errorJson.error || "Failed to load conversations");
          }
        } catch (_e) {
          throw new Error("Failed to load conversations");
        }
      }
    } catch (error: unknown) {

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


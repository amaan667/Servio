import { useState } from 'react';
import { ChatMessage, ChatConversation } from '../types';

export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const loadMessages = async (conversationId: string) => {
    try {
      console.debug("[AI CHAT] Loading messages for conversation:", conversationId);
      const response = await fetch(`/api/ai-assistant/conversations/${conversationId}/messages`);
      console.debug("[AI CHAT] Messages response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.debug("[AI CHAT] Loaded messages:", data.messages);
        setMessages(data.messages || []);
      } else {
        throw new Error("Failed to load messages");
      }
    } catch (error: unknown) {
      console.error("[AI CHAT] Error loading messages:", error);
      throw error;
    }
  };

  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };

  const updateMessage = (messageId: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    messages,
    loadMessages,
    addMessage,
    updateMessage,
    clearMessages,
  };
}


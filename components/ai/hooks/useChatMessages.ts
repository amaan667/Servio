import { useState } from 'react';
import { ChatMessage, ChatConversation } from '../types';

export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const loadMessages = async (conversationId: string) => {
    try {

      const response = await fetch(`/api/ai-assistant/conversations/${conversationId}/messages`);

      if (response.ok) {
        const data = await response.json();

        setMessages(data.messages || []);
      } else {
        throw new Error("Failed to load messages");
      }
    } catch (error: unknown) {

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


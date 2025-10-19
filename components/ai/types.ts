import { AIPlanResponse, AIPreviewDiff } from "@/types/ai-assistant";

export interface ChatMessage {
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

export interface ChatConversation {
  id: string;
  title: string;
  venueId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  messages: ChatMessage[];
}

export interface ChatInterfaceProps {
  venueId: string;
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

export interface ChatState {
  conversations: ChatConversation[];
  currentConversation: ChatConversation | null;
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  plan: AIPlanResponse | null;
  previews: AIPreviewDiff[];
  executing: boolean;
  error: string | null;
  success: boolean;
  executionResults: any[];
  undoing: string | null;
}


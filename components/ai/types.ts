import { AIPlanResponse, AIPreviewDiff } from "@/types/ai-assistant";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolName?: string;
  toolParams?: unknown;
  executionResult?: unknown;
  auditId?: string;
  createdAt: string;
  canUndo: boolean;
  undoData?: unknown;
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
  executionResults: unknown[];
  undoing: string | null;
}

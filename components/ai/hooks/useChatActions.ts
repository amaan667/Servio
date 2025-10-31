import { useState } from "react";
import { ChatMessage } from "../types";
import { AIPlanResponse, AIPreviewDiff } from "@/types/ai-assistant";

export function useChatActions(venueId: string) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<AIPlanResponse | null>(null);
  const [previews, setPreviews] = useState<AIPreviewDiff[]>([]);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [executionResults, setExecutionResults] = useState<unknown[]>([]);
  const [undoing, setUndoing] = useState<string | null>(null);

  const sendMessage = async (_conversationId: string, message: string) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setPlan(null);
    setPreviews([]);
    setExecutionResults([]);

    try {
      const response = await fetch("/api/ai-assistant/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: message,
          venueId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI plan");
      }

      const data = await response.json();
      setPlan(data.plan);
      setPreviews(data.previews || []);
      setSuccess(true);

      // Return the plan data so it can be used immediately
      return data.plan;
    } catch (error: unknown) {
      setError((error as any).message || "Failed to send message");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const executePlan = async (conversationId: string) => {
    if (!plan) return;

    setExecuting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/ai-assistant/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          plan,
          venueId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to execute plan");
      }

      const data = await response.json();
      setExecutionResults(data.results || []);
      setSuccess(true);
    } catch (error: unknown) {
      setError((error as any).message || "Failed to execute plan");
    } finally {
      setExecuting(false);
    }
  };

  const undoAction = async (messageId: string, auditId: string) => {
    setUndoing(messageId);
    setError(null);

    try {
      const response = await fetch("/api/ai-assistant/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId,
          venueId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to undo action");
      }

      setSuccess(true);
    } catch (error: unknown) {
      setError((error as any).message || "Failed to undo action");
    } finally {
      setUndoing(null);
    }
  };

  return {
    loading,
    plan,
    previews,
    executing,
    error,
    success,
    executionResults,
    undoing,
    sendMessage,
    executePlan,
    undoAction,
    setError,
    setSuccess,
  };
}

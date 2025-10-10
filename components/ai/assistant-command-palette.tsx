"use client";

// AI Assistant - Command Palette Component
// Global ⌘K / Ctrl-K command palette for AI assistance

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, AlertTriangle, Check, X } from "lucide-react";
import { AIPlanResponse, AIPreviewDiff } from "@/types/ai-assistant";
import { AIAssistantFloat } from "./ai-assistant-float";

interface AssistantCommandPaletteProps {
  venueId: string;
  page?: "menu" | "inventory" | "kds" | "orders" | "analytics" | "general";
  suggestions?: string[];
}

export function AssistantCommandPalette({
  venueId,
  page = "general",
  suggestions = [],
}: AssistantCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<AIPlanResponse | null>(null);
  const [previews, setPreviews] = useState<AIPreviewDiff[]>([]);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Keyboard shortcut: ⌘K / Ctrl-K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setPlan(null);
      setPreviews([]);
      setError(null);
      setSuccess(false);
      setPrompt("");
    }
  }, [open]);

  const handlePlan = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setPlan(null);
    setPreviews([]);

    try {
      const response = await fetch("/api/ai-assistant/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          venueId,
          context: { page },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If access denied, try to fix it automatically
        if (response.status === 403 && data.error?.includes("Access denied")) {
          console.log("[AI ASSISTANT] Access denied, attempting to fix...");
          
          const fixResponse = await fetch("/api/ai-assistant/fix-access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ venueId }),
          });

          const fixData = await fixResponse.json();

          if (fixResponse.ok) {
            console.log("[AI ASSISTANT] Access fixed, retrying...");
            // Retry the original request
            const retryResponse = await fetch("/api/ai-assistant/plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: prompt.trim(),
                venueId,
                context: { page },
              }),
            });

            const retryData = await retryResponse.json();

            if (!retryResponse.ok) {
              throw new Error(retryData.error || "Planning failed after fixing access");
            }

            setPlan(retryData.plan);
            
            // Fetch previews for each tool after successful retry
            const retryPreviewPromises = retryData.plan.tools.map((tool: any) =>
              fetch("/api/ai-assistant/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  venueId,
                  toolName: tool.name,
                  params: tool.params,
                  preview: true,
                }),
              }).then((res) => res.json())
            );

            const retryPreviewResults = await Promise.all(retryPreviewPromises);
            setPreviews(retryPreviewResults.map((r) => r.preview));
          } else {
            throw new Error(fixData.error || "Failed to fix access");
          }
        } else {
          throw new Error(data.error || "Planning failed");
        }
      } else {
        setPlan(data.plan);
        
        // Fetch previews for each tool
        const previewPromises = data.plan.tools.map(async (tool: any) => {
          try {
            const res = await fetch("/api/ai-assistant/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                venueId,
                toolName: tool.name,
                params: tool.params,
                preview: true,
              }),
            });
            
            const json = await res.json();
            
            if (!res.ok) {
              console.error(`[AI ASSISTANT] Preview failed for ${tool.name}:`, json.error);
              throw new Error(json.error || "Preview failed");
            }
            
            return json;
          } catch (error) {
            console.error(`[AI ASSISTANT] Preview error for ${tool.name}:`, error);
            throw error;
          }
        });

        const previewResults = await Promise.all(previewPromises);
        setPreviews(previewResults.map((r) => r.preview).filter(Boolean));
      }
    } catch (err: any) {
      console.error("[AI ASSISTANT] Planning error:", err);
      setError(err.message || "Failed to plan action");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!plan) return;

    setExecuting(true);
    setError(null);

    try {
      // Execute each tool in sequence and collect results
      const results: any[] = [];
      
      for (const tool of plan.tools) {
        const response = await fetch("/api/ai-assistant/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venueId,
            toolName: tool.name,
            params: tool.params,
            preview: false,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Execution failed");
        }
        
        results.push(data.result);
      }

      setSuccess(true);
      
      // Check if any tool was analytics
      const hasAnalytics = plan.tools.some(tool => 
        tool.name.startsWith("analytics.")
      );
      
      // Display analytics results if present
      if (hasAnalytics && results.length > 0) {
        const analyticsResult = results.find(r => r && r.message);
        if (analyticsResult) {
          alert(analyticsResult.message);
        }
        
        // Close modal after showing results
        setTimeout(() => {
          setOpen(false);
        }, 2000);
        return;
      }
      
      // Check if any tool was a navigation action
      const hasNavigation = plan.tools.some(tool => tool.name === "navigation.go_to_page");
      
      if (hasNavigation) {
        // For navigation, close immediately and navigate
        setTimeout(() => {
          setOpen(false);
          
          // Find the navigation tool and execute it
          const navTool = plan.tools.find(tool => tool.name === "navigation.go_to_page");
          if (navTool && navTool.params?.page) {
            const routeMap: Record<string, string> = {
              "dashboard": `/dashboard/${venueId}`,
              "menu": `/dashboard/${venueId}/menu-management`,
              "inventory": `/dashboard/${venueId}/inventory`,
              "orders": `/dashboard/${venueId}/orders`,
              "live-orders": `/dashboard/${venueId}/live-orders`,
              "kds": `/dashboard/${venueId}/kds`,
              "kitchen-display": `/dashboard/${venueId}/kds`,
              "qr-codes": `/generate-qr`, // Fixed: qr-codes page doesn't exist, use generate-qr
              "generate-qr": `/generate-qr`,
              "analytics": `/dashboard/${venueId}/analytics`,
              "settings": `/dashboard/${venueId}/settings`,
              "staff": `/dashboard/${venueId}/staff`,
              "tables": `/dashboard/${venueId}/tables`,
              "feedback": `/dashboard/${venueId}/feedback`,
            };
            
            const targetRoute = routeMap[navTool.params.page];
            if (targetRoute) {
              window.location.href = targetRoute;
            }
          }
        }, 1000);
      } else {
        // For non-navigation actions, close after 2 seconds and refresh
        setTimeout(() => {
          setOpen(false);
        }, 2000);

        // Refresh the page to show updates
        window.location.reload();
      }
    } catch (err: any) {
      console.error("[AI ASSISTANT] Execution error:", err);
      setError(err.message || "Failed to execute action");
    } finally {
      setExecuting(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  return (
    <>
      {/* Floating AI Assistant Button */}
      <AIAssistantFloat onClick={() => setOpen(true)} />
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Servio AI Assistant
            </DialogTitle>
            <DialogDescription>
              Ask me anything about your business operations
            </DialogDescription>
          </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Input */}
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Increase all coffee prices by 5%..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handlePlan();
                }
              }}
              disabled={loading || executing}
              className="flex-1"
            />
            <Button
              onClick={handlePlan}
              disabled={loading || executing || !prompt.trim()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Plan"
              )}
            </Button>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && !plan && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Try:</span>
              {suggestions.slice(0, 3).map((suggestion, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Error</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
              <Check className="h-4 w-4 text-green-500" />
              <p className="text-sm font-medium text-green-500">
                Action completed successfully!
              </p>
            </div>
          )}

          {/* Plan & Preview */}
          {plan && !success && (
            <ScrollArea className="flex-1 -mr-4 pr-4">
              <div className="space-y-4">
                {/* Intent & Reasoning */}
                <div className="space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold">Plan</h3>
                    <p className="text-sm text-muted-foreground">{plan.intent}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Why this is safe</h3>
                    <p className="text-sm text-muted-foreground">{plan.reasoning}</p>
                  </div>
                </div>

                {/* Warnings */}
                {plan.warnings && plan.warnings.length > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      {plan.warnings.map((warning, i) => (
                        <p key={i} className="text-sm text-amber-600 dark:text-amber-400">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview Diffs */}
                {previews.map((preview, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold capitalize">
                        {preview.toolName.replace(/\./g, " → ")}
                      </h3>
                      <Badge variant="outline">
                        {preview.impact.itemsAffected} items
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {preview.impact.description}
                    </p>

                    {/* Before/After Table */}
                    {Array.isArray(preview.before) && preview.before.length > 0 && (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium mb-2">Before</p>
                          <div className="space-y-1">
                            {preview.before.slice(0, 5).map((item: any, j: number) => (
                              <div
                                key={j}
                                className="text-muted-foreground"
                              >
                                {item.name || item.id}: £{item.price?.toFixed(2) || item.onHand || "-"}
                              </div>
                            ))}
                            {preview.before.length > 5 && (
                              <div className="text-xs text-muted-foreground">
                                +{preview.before.length - 5} more...
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="font-medium mb-2">After</p>
                          <div className="space-y-1">
                            {preview.after.slice(0, 5).map((item: any, j: number) => (
                              <div
                                key={j}
                                className="text-green-600 dark:text-green-400"
                              >
                                {item.name || item.id}: £{item.price?.toFixed(2) || item.onHand || "-"}
                              </div>
                            ))}
                            {preview.after.length > 5 && (
                              <div className="text-xs text-muted-foreground">
                                +{preview.after.length - 5} more...
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Execute Button */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPlan(null);
                      setPreviews([]);
                    }}
                    disabled={executing}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleExecute}
                    disabled={executing}
                    className="flex-1"
                  >
                    {executing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Confirm & Execute
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer Hint */}
        {!plan && (
          <div className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1 py-0.5 bg-muted rounded">⌘</kbd> +{" "}
            <kbd className="px-1 py-0.5 bg-muted rounded">K</kbd> to toggle
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}


"use client";

// AI Assistant - Command Palette Component
// Global ⌘K / Ctrl-K command palette for AI assistance

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
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
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  Check,
  X,
  TrendingUp,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import { AIPlanResponse, AIPreviewDiff } from "@/types/ai-assistant";
import { AIAssistantFloat } from "./ai-assistant-float";
import { ChatInterfaceV2 } from "./chat-interface-v2";
import { aiLogger } from "@/lib/logger";

interface Tool {
  name: string;
  params: Record<string, unknown>;
}

interface ExecutionResult {
  tool: string;
  result: {
    topItems?: Array<{ name: string; revenue: number }>;
    message?: string;
    revenue?: number;
    total?: number;
    quantitySold?: number;
    orderCount?: number;
    averagePerOrder?: number;
    count?: number;
    average?: number;
    page?: string;
    [key: string]: unknown;
  };
}

interface PreviewItem {
  name?: string;
  id?: string;
  price?: number;
  onHand?: number;
}

interface AssistantCommandPaletteProps {
  venueId: string;
  page?: "menu" | "inventory" | "kds" | "orders" | "analytics" | "general";
  suggestions?: string[];
  showChatHistory?: boolean;
}

export function AssistantCommandPalette({
  venueId,
  page = "general",
  suggestions = [],
  showChatHistory = false,
}: AssistantCommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Detect current page from pathname
  const currentPage = pathname?.split("/").pop() || page;
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<AIPlanResponse | null>(null);
  const [previews, setPreviews] = useState<AIPreviewDiff[]>([]);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [showChatInterface, setShowChatInterface] = useState(false);

  // Keyboard shortcut: ⌘K / Ctrl-K - Opens expanded chat interface directly
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (showChatHistory) {
          // Open expanded chat interface directly
          setShowChatInterface(true);
        } else {
          // Fallback to short form if chat history not enabled
          setOpen((open) => !open);
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [showChatHistory]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setPlan(null);
      setPreviews([]);
      setError(null);
      setSuccess(false);
      setPrompt("");
      setExecutionResults([]);
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
          const fixResponse = await fetch("/api/ai-assistant/fix-access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ venueId }),
          });

          const fixData = await fixResponse.json();

          if (fixResponse.ok) {
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
            const retryPreviewPromises = retryData.plan.tools.map((tool: unknown) =>
              fetch("/api/ai-assistant/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  venueId,
                  toolName: (tool as Tool).name,
                  params: (tool as Tool).params,
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
        const previewPromises = data.plan.tools.map(async (tool: unknown) => {
          try {
            const res = await fetch("/api/ai-assistant/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                venueId,
                toolName: (tool as Tool).name,
                params: (tool as Tool).params,
                preview: true,
              }),
            });

            const json = await res.json();

            if (!res.ok) {
              throw new Error(json.error || "Preview failed");
            }

            return json;
          } catch (_error) {
            throw error;
          }
        });

        const previewResults = await Promise.all(previewPromises);
        setPreviews(previewResults.map((r) => r.preview).filter(Boolean));
      }
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to plan action");
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
      const results: unknown[] = [];

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

        results.push({ tool: tool.name, result: data.result });
      }

      setSuccess(true);
      setExecutionResults(results as ExecutionResult[]);

      // Check if unknown tool was analytics
      const hasAnalytics = plan.tools.some((tool) => tool.name.startsWith("analytics."));

      // Check if unknown tool was a navigation action
      const hasNavigation = plan.tools.some((tool) => tool.name === "navigation.go_to_page");

      if (hasNavigation) {
        // For navigation, wait 1.5 seconds then navigate using Next.js router
        setTimeout(() => {
          setOpen(false);

          // Find the navigation tool result
          const navResult = (results as ExecutionResult[]).find(
            (r) => r.tool === "navigation.go_to_page"
          );
          if (
            navResult &&
            typeof navResult === "object" &&
            "result" in navResult &&
            navResult.result &&
            typeof navResult.result === "object" &&
            "route" in navResult.result
          ) {
            router.push((navResult.result as { route: string }).route);
          }
        }, 1500);
      } else if (!hasAnalytics) {
        // For non-analytics actions, close after 3 seconds and refresh
        setTimeout(() => {
          setOpen(false);
          router.refresh(); // Use Next.js router refresh instead of window.location.reload()
        }, 3000);
      }
      // For analytics, keep modal open so user can see results
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to execute action");
    } finally {
      setExecuting(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  // Get success message based on tool name
  const getSuccessMessage = (toolName: string): string => {
    const messages: Record<string, string> = {
      "menu.update_prices": "✓ Prices updated successfully!",
      "menu.toggle_availability": "✓ Menu items visibility changed!",
      "menu.create_item": "✓ New menu item created!",
      "menu.delete_item": "✓ Menu item deleted!",
      "menu.translate": "✓ Menu translated successfully!",
      "inventory.adjust_stock": "✓ Stock levels adjusted!",
      "inventory.set_par_levels": "✓ Par levels updated!",
      "inventory.generate_purchase_order": "✓ Purchase order generated!",
      "orders.mark_served": "✓ Order marked as served!",
      "orders.complete": "✓ Order completed!",
      "analytics.get_insights": "✓ Analytics retrieved!",
      "analytics.get_stats": "✓ Statistics generated!",
      "analytics.export": "✓ Data exported!",
      "analytics.create_report": "✓ Report created!",
      "discounts.create": "✓ Discount created!",
      "kds.get_overdue": "✓ Overdue tickets found!",
      "kds.suggest_optimization": "✓ Optimization suggestions ready!",
      "navigation.go_to_page": "✓ Navigating...",
    };
    return messages[toolName] || "✓ Action completed successfully!";
  };

  return (
    <>
      {/* Floating AI Assistant Button */}
      <AIAssistantFloat
        onClick={() => {
          if (showChatHistory) {
            // Open expanded chat interface directly
            setShowChatInterface(true);
          } else {
            // Fallback to short form if chat history not enabled
            setOpen(true);
          }
        }}
      />

      {/* Chat Interface */}
      {showChatHistory && (
        <ChatInterfaceV2
          venueId={venueId}
          isOpen={showChatInterface}
          onClose={() => setShowChatInterface(false)}
          currentPage={currentPage}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Servio AI Assistant
            </DialogTitle>
            <DialogDescription>Ask me anything about your business operations</DialogDescription>
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
              <Button onClick={handlePlan} disabled={loading || executing || !prompt.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Plan"}
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
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                  <Check className="h-4 w-4 text-green-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-500">
                      {plan?.tools.length === 1
                        ? getSuccessMessage(plan.tools[0].name)
                        : `All ${plan?.tools.length || 0} actions completed successfully!`}
                    </p>
                    <p className="text-xs text-green-600/80 mt-0.5">{plan?.intent}</p>
                  </div>
                </div>

                {/* Display execution results */}
                {executionResults.length > 0 && (
                  <div className="space-y-3">
                    {executionResults.map((item, idx) => {
                      const result = item.result;

                      // Analytics results display
                      if (item.tool.startsWith("analytics.")) {
                        return (
                          <div
                            key={idx}
                            className="border rounded-lg p-4 space-y-3 bg-blue-50/50 dark:bg-blue-950/20"
                          >
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-5 w-5 text-blue-500" />
                              <h3 className="font-semibold text-blue-700 dark:text-blue-300">
                                Analytics Results
                              </h3>
                            </div>

                            {result.message && (
                              <p className="text-sm text-muted-foreground">{result.message}</p>
                            )}

                            {/* Revenue stats */}
                            {(result.revenue !== undefined || result.total !== undefined) && (
                              <div className="grid grid-cols-2 gap-3">
                                {(result.revenue !== undefined || result.total !== undefined) && (
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                                      <DollarSign className="h-4 w-4" />
                                      <span className="text-xs font-medium">Revenue</span>
                                    </div>
                                    <p className="text-xl font-bold">
                                      £{(result.revenue || result.total || 0).toFixed(2)}
                                    </p>
                                  </div>
                                )}

                                {result.quantitySold !== undefined && (
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                      Units Sold
                                    </p>
                                    <p className="text-xl font-bold">{result.quantitySold}</p>
                                  </div>
                                )}

                                {result.orderCount !== undefined && (
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                      Orders
                                    </p>
                                    <p className="text-xl font-bold">{result.orderCount}</p>
                                  </div>
                                )}

                                {result.averagePerOrder !== undefined &&
                                  result.averagePerOrder > 0 && (
                                    <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                                      <p className="text-xs font-medium text-muted-foreground mb-1">
                                        Avg Per Order
                                      </p>
                                      <p className="text-xl font-bold">
                                        £{result.averagePerOrder.toFixed(2)}
                                      </p>
                                    </div>
                                  )}

                                {result.count !== undefined && !result.orderCount && (
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                      Count
                                    </p>
                                    <p className="text-xl font-bold">{result.count}</p>
                                  </div>
                                )}

                                {result.average !== undefined && (
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                      Average
                                    </p>
                                    <p className="text-xl font-bold">
                                      £{result.average.toFixed(2)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Top items list */}
                            {result.topItems && result.topItems.length > 0 && (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  Top Items
                                </p>
                                <div className="space-y-1">
                                  {result.topItems?.slice(0, 5).map((item, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                      <span>{item.name}</span>
                                      <span className="font-semibold">
                                        £{item.revenue.toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Navigation results
                      if (item.tool === "navigation.go_to_page") {
                        return (
                          <div key={idx} className="text-sm text-muted-foreground">
                            Navigating to {result.page}...
                          </div>
                        );
                      }

                      // Other results with messages
                      if (result.message) {
                        return (
                          <div
                            key={idx}
                            className="text-sm text-muted-foreground p-3 bg-gray-50 dark:bg-gray-800 rounded border"
                          >
                            {result.message}
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                )}
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
                        <Badge variant="outline">{preview.impact.itemsAffected} items</Badge>
                      </div>

                      <p className="text-sm text-muted-foreground">{preview.impact.description}</p>

                      {/* Before/After Table */}
                      {Array.isArray(preview.before) && preview.before.length > 0 && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-medium mb-2">Before</p>
                            <div className="space-y-1">
                              {preview.before.slice(0, 5).map((item: unknown, j: number) => {
                                const previewItem = item as PreviewItem;
                                return (
                                  <div key={j} className="text-muted-foreground">
                                    {previewItem.name || previewItem.id}: £
                                    {previewItem.price?.toFixed(2) || previewItem.onHand || "-"}
                                  </div>
                                );
                              })}
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
                              {Array.isArray(preview.after) &&
                                preview.after.slice(0, 5).map((item: unknown, j: number) => {
                                  const previewItem = item as PreviewItem;
                                  return (
                                    <div key={j} className="text-green-600 dark:text-green-400">
                                      {previewItem.name || previewItem.id}: £
                                      {previewItem.price?.toFixed(2) || previewItem.onHand || "-"}
                                    </div>
                                  );
                                })}
                              {Array.isArray(preview.after) && preview.after.length > 5 && (
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
                    <Button onClick={handleExecute} disabled={executing} className="flex-1">
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

          {/* Footer with Chat History button and hint */}
          <div className="flex items-center justify-between pt-4 border-t">
            {showChatHistory && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  setShowChatInterface(true);
                }}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat History
              </Button>
            )}
            {!plan && (
              <div
                className={`text-xs text-muted-foreground ${showChatHistory ? "" : "text-center w-full"}`}
              >
                Press <kbd className="px-1 py-0.5 bg-muted rounded">⌘</kbd> +{" "}
                <kbd className="px-1 py-0.5 bg-muted rounded">K</kbd> to toggle
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

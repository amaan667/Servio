"use client";

// AI Assistant - Contextual Drawer Component
// Page-specific assistant with contextual suggestions

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ChevronRight } from "lucide-react";
import { AssistantCommandPalette } from "./assistant-command-palette";

interface DataSummary {
  lowStock?: Array<{ name: string; quantity: number }>;
  topSellers?: Array<{ name: string; sales7d: number }>;
  overdueTickets?: Array<{ id: string; station: string }>;
  bottlenecks?: Array<{ station: string; avgWaitTime: number }>;
}

interface ContextualAssistantProps {
  venueId: string;
  page: "menu" | "inventory" | "kds" | "orders" | "analytics";
  dataSummary?: DataSummary;
}

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  menu: [
    "Increase all coffee prices by 5%",
    "Hide items with less than 3 sales this week",
    "Translate menu to Spanish",
    "Show top 5 revenue-driving items",
  ],
  inventory: [
    "Show low stock items",
    "Create purchase order for tomorrow",
    "Set par levels based on last 30 days",
    "Mark ingredients as received",
  ],
  kds: [
    "Show overdue tickets on Fryer station",
    "Summarize lunch rush performance",
    "Balance load across stations",
    "Suggest SLA improvements",
  ],
  orders: [
    "Mark order #307 as served",
    "Show tables with unpaid checks over 15 minutes",
    "Complete order for table 5",
    "Daily order summary",
  ],
  analytics: [
    "Which 5 items drive 80% of revenue?",
    "Show yesterday's performance",
    "Compare this week to last week",
    "Export sales data as CSV",
  ],
};

export function ContextualAssistant({ venueId, page, dataSummary }: ContextualAssistantProps) {
  const [showPalette, setShowPalette] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [insights, setInsights] = useState<string[]>([]);

  const suggestions = PAGE_SUGGESTIONS[page] || [];

  // Generate AI insights based on data summary
  useEffect(() => {
    if (!dataSummary) return;

    const newInsights: string[] = [];

    // Inventory-specific insights
    if (page === "inventory" && dataSummary?.lowStock && dataSummary.lowStock.length > 0) {
      newInsights.push(`${dataSummary.lowStock.length} items below reorder level`);
    }

    // Menu-specific insights
    if (page === "menu" && dataSummary?.topSellers && dataSummary.topSellers.length > 0) {
      const top = dataSummary.topSellers[0];
      newInsights.push(`${top.name} is your top seller (${top.sales7d} sales)`);
    }

    // Orders-specific insights
    if (page === "orders" && dataSummary?.overdueTickets && dataSummary.overdueTickets.length > 0) {
      newInsights.push(`${dataSummary.overdueTickets.length} tickets overdue`);
    }

    // KDS-specific insights
    if (page === "kds" && dataSummary?.bottlenecks && dataSummary.bottlenecks.length > 0) {
      const bottleneck = dataSummary.bottlenecks[0];
      newInsights.push(`${bottleneck.station} has ${bottleneck.avgWaitTime}min avg wait`);
    }

    setInsights(newInsights);
  }, [dataSummary, page]);

  const handleSuggestionClick = (suggestion: string) => {
    setSelectedPrompt(suggestion);
    setShowPalette(true);
  };

  return (
    <>
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-base">AI Assistant</CardTitle>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowPalette(true)}>
              Ask AI
            </Button>
          </div>
          <CardDescription>Quick actions and insights for this page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Insights */}
          {insights.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Insights</p>
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded"
                >
                  <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center">
                    !
                  </Badge>
                  {insight}
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Quick Actions</p>
            <div className="space-y-1">
              {suggestions.slice(0, 3).map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full flex items-center justify-between text-sm p-2 rounded hover:bg-accent transition-colors text-left"
                >
                  <span className="text-muted-foreground">{suggestion}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Command Palette */}
      {showPalette && (
        <AssistantCommandPalette venueId={venueId} page={page} suggestions={suggestions} />
      )}
    </>
  );
}

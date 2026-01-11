"use client";

// AI Assistant - Activity Log Component
// Shows recent AI assistant actions for transparency

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Clock, Check, X, Eye, Keyboard } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AIActionAudit } from "@/types/ai-assistant";

interface ActivityLogProps {

}

export function AIActivityLog({ venueId, limit = 20 }: ActivityLogProps) {
  const [activities, setActivities] = useState<AIActionAudit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [venueId]);

  const fetchActivities = async () => {
    try {
      const response = await fetch(`/api/ai-assistant/activity?venueId=${venueId}&limit=${limit}`);
      const data = await response.json();

      if (response.ok) {
        setActivities(data.activities || []);
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (activity: AIActionAudit) => {
    if (activity.error) {
      return <X className="h-4 w-4 text-destructive" />;
    }
    if (activity.executed) {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    if (activity.preview) {
      return <Eye className="h-4 w-4 text-blue-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (activity: AIActionAudit) => {
    if (activity.error) {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (activity.executed) {
      return (
        <Badge variant="default" className="bg-green-500">
          Executed
        </Badge>
      );
    }
    if (activity.preview) {
      return <Badge variant="secondary">Preview</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <CardTitle>AI Assistant Activity</CardTitle>
          </div>
          <CardDescription>Loading recent actions...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <CardTitle>AI Assistant Activity</CardTitle>
        </div>
        <CardDescription>Recent AI-powered actions and their outcomes</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <div className="relative inline-block mb-4">
                <Sparkles className="h-12 w-12 mx-auto text-purple-500 opacity-30" />
                <Keyboard className="h-6 w-6 absolute -bottom-1 -right-1 text-purple-600" />
              </div>
              <p className="text-sm font-medium mb-2">No AI assistant activity yet</p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>Press</span>
                <kbd className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded font-mono text-xs border border-purple-200 dark:border-purple-800">
                  ⌘K
                </kbd>
                <span>or click the floating</span>
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span>button</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {getStatusIcon(activity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{activity.userPrompt}</p>
                      {getStatusBadge(activity)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{activity.toolName.replace(/\./g, " → ")}</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(activity.createdAt), {

                        })}
                      </span>
                      {activity.executionTimeMs && (
                        <>
                          <span>•</span>
                          <span>{activity.executionTimeMs}ms</span>
                        </>
                      )}
                    </div>
                    {activity.error && (
                      <p className="text-xs text-destructive mt-1">{activity.error}</p>
                    )}
                    {activity.result !== undefined && activity.result !== null && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {typeof activity.result === "object" ? (
                          <span>
                            {(() => {
                              const resultObj = activity.result as Record<string, unknown>;
                              const parts: string[] = [];
                              if (typeof resultObj.updatedCount === "number") {
                                parts.push(`${resultObj.updatedCount} items affected`);
                              }
                              if (typeof resultObj.revenue === "number") {
                                parts.push(`Revenue: £${resultObj.revenue.toFixed(2)}`);
                              }
                              return parts.join(" • ");
                            })()}
                          </span>
                        ) : (
                          <span>{String(activity.result)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

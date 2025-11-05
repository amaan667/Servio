import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { AIPlanResponse, AIPreviewDiff } from "@/types/ai-assistant";

interface PlanPreviewProps {
  plan: AIPlanResponse | null;
  previews: AIPreviewDiff[];
  executing: boolean;
  onExecute: () => void;
}

export function PlanPreview({ plan, previews, executing, onExecute }: PlanPreviewProps) {
  if (!plan) return null;

  // Only show preview if there are tools to execute
  if (!plan.tools || plan.tools.length === 0) return null;

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>AI Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold mb-2">Actions:</h4>
          <ol className="list-decimal list-inside space-y-1">
            {plan.tools.map((tool, idx: number) => (
              <li key={idx} className="text-sm">
                {tool.name.replace(/\./g, " › ")}
              </li>
            ))}
          </ol>
        </div>

        {previews.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Preview Changes:</h4>
            <div className="space-y-2">
              {previews.map((preview, idx: number) => {
                const impactDesc = preview.impact?.description || "No description";
                const toolName = preview.toolName || "Change";
                return (
                  <div key={idx} className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <Badge>{toolName}</Badge>
                    <p className="text-xs mt-1">{impactDesc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button onClick={onExecute} disabled={executing} className="w-full">
          {executing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Execute Plan
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

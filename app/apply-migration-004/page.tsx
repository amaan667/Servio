"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ApplyMigration004Page() {
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const applyMigration = async () => {
    setApplying(true);
    setResult(null);

    try {
      const response = await fetch("/api/migrations/apply-004", {
        method: "POST",
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to apply migration",
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle>Apply Migration 004</CardTitle>
          <p className="text-sm text-muted-foreground">
            Fix dashboard counts and table management logic
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-2">What this migration does:</h3>
            <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
              <li>Fixes Today&apos;s Orders count (Live + Earlier Today)</li>
              <li>Updates table counts to reflect actual tables table</li>
              <li>Fixes table utilization calculations</li>
              <li>Ensures all dashboard counts are accurate</li>
            </ul>
          </div>

          <Button onClick={applyMigration} disabled={applying} className="w-full" size="lg">
            {applying ? "Applying Migration..." : "Apply Migration 004"}
          </Button>

          {result && (
            <div
              className={`p-4 rounded-lg border ${
                result.success
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              <p className="font-semibold mb-1">{result.success ? "✅ Success" : "❌ Error"}</p>
              <p className="text-sm">{result.message}</p>
            </div>
          )}

          {result?.success && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                ✅ Migration applied successfully! You can now close this page and refresh your
                dashboard to see the updated counts.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

// Admin page to run AI conversations migration
// This should only be accessible to admin users

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

export default function MigrateAIPage() {
  const [loading, setLoading] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{
    migrationStatus?: Array<{
      table_name: string;
      total_conversations: number;
      generic_titles: number;
      oldest_conversation: string;
      newest_conversation: string;
    }>;
    conversationsNeedingAiTitles?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const checkMigrationStatus = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/migrate-ai-conversations");
      const data = await response.json();

      if (response.ok) {
        setMigrationStatus(data);
        setSuccess("Migration status checked successfully");
      } else {
        setError(data.error || "Failed to check migration status");
      }
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : String(_error);
      setError("Failed to check migration status: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const runMigration = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/migrate-ai-conversations", {
        method: "POST",
      });
      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || "Migration completed successfully");
        // Refresh status after migration
        await checkMigrationStatus();
      } else {
        setError(data.error || "Migration failed");
      }
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : String(_error);
      setError("Migration failed: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">AI Conversations Migration</h1>
        <p className="text-muted-foreground">
          Migrate AI conversations from the old system to the new system with AI-powered titles.
        </p>
      </div>

      <div className="space-y-6">
        {/* Migration Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Migration Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={checkMigrationStatus} disabled={loading} variant="outline">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Check Status
              </Button>

              <Button
                onClick={runMigration}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                Run Migration
              </Button>
            </div>

            {migrationStatus && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {migrationStatus.migrationStatus?.map((status, index: number) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{status.table_name}</span>
                        <Badge
                          variant={
                            status.table_name === "ai_chat_conversations" ? "default" : "secondary"
                          }
                        >
                          {status.total_conversations} conversations
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>Generic titles: {status.generic_titles}</div>
                        <div>
                          Oldest: {new Date(status.oldest_conversation).toLocaleDateString()}
                        </div>
                        <div>
                          Newest: {new Date(status.newest_conversation).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-950">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">AI Title Generation</span>
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    {migrationStatus.conversationsNeedingAiTitles} conversations need AI-generated
                    titles
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Migration Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">What this migration does:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Creates new AI chat tables if they don&apos;t exist</li>
                <li>Migrates conversations from old system to new system</li>
                <li>Generates AI-powered titles for existing conversations</li>
                <li>Preserves all conversation history and messages</li>
                <li>Sets up proper security policies and indexes</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Manual SQL Migration:</h4>
              <p className="text-sm text-muted-foreground">
                If the API migration fails, you can run the SQL migration manually:
              </p>
              <code className="block bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs">
                Run the SQL from: migrations/migrate-ai-conversations.sql
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

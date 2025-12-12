"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  AlertTriangle,
  Database,
  Users,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";

const hasSupabaseConfig = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

interface LocalAccount {
  venueId: string;
  venueName: string;
  contactName: string;
  contactEmail: string;
  venueType: string;
  passwordHash: string;
  createdAt: string;
}

export function AccountMigrator() {
  const [localAccounts, setLocalAccounts] = useState<LocalAccount[]>([]);
  const [migrationStatus, setMigrationStatus] = useState<
    Record<string, "pending" | "success" | "error">
  >({
    /* Empty */
  });
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    loadLocalAccounts();
  }, []);

  const loadLocalAccounts = () => {
    try {
      const stored = localStorage.getItem("servio-accounts");
      const accounts = stored ? JSON.parse(stored) : [];
      setLocalAccounts(accounts);
    } catch (_error) {
      setLocalAccounts([]);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs((prev: string[]) => [...prev, logEntry]);
  };

  const migrateAccount = async (account: LocalAccount): Promise<boolean> => {
    addLog(`Starting migration for ${account.contactEmail}`);

    try {
      // Decode password from base64
      atob(account.passwordHash);
      addLog(`Decoded password for ${account.contactEmail}`);

      addLog(`⚠️ Sign up not implemented yet for ${account.contactEmail}`);
      return false;
    } catch (_error) {
      addLog(`❌ Error migrating ${account.contactEmail}: ${(_error as Error).message}`);

      return false;
    }
  };

  const migrateAllAccounts = async () => {
    if (!hasSupabaseConfig) {
      addLog("❌ Cannot migrate: Supabase configuration missing");
      return;
    }

    setIsMigrating(true);
    setMigrationProgress(0);
    setLogs([]);
    addLog("🚀 Starting bulk migration process");

    const totalAccounts = localAccounts.length;
    let successCount = 0;

    for (let i = 0; i < localAccounts.length; i++) {
      const account = localAccounts[i];
      setMigrationStatus((prev: Record<string, "pending" | "success" | "error">) => ({
        ...prev,
        [account.contactEmail]: "pending",
      }));

      const success = await migrateAccount(account);

      setMigrationStatus((prev: Record<string, "pending" | "success" | "error">) => ({
        ...prev,
        [account.contactEmail]: success ? "success" : "error",
      }));

      if (success) successCount++;

      const progress = ((i + 1) / totalAccounts) * 100;
      setMigrationProgress(progress);

      // Remove artificial delay - process migrations immediately
    }

    addLog(
      `🎉 Migration complete: ${successCount}/${totalAccounts} accounts migrated successfully`
    );
    setIsMigrating(false);
  };

  const clearLocalAccounts = () => {
    if (confirm("Are you sure you want to clear all local accounts? This cannot be undone.")) {
      localStorage.removeItem("servio-accounts");
      setLocalAccounts([]);
      setMigrationStatus({
        /* Empty */
      });
      addLog("🗑️ Local accounts cleared");
    }
  };

  const exportAccounts = () => {
    const dataStr = JSON.stringify(localAccounts, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `servio-accounts-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addLog("📥 Accounts exported to file");
  };

  const importAccounts = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          localStorage.setItem("servio-accounts", JSON.stringify(imported));
          loadLocalAccounts();
          addLog(`📤 Imported ${imported.length} accounts`);
        } else {
          addLog("❌ Invalid file format");
        }
      } catch (_error) {
        addLog("❌ Failed to import accounts");
      }
    };
    reader.readAsText(file);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "pending":
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Account Migration Status</span>
          </CardTitle>
          <CardDescription>Migrate local accounts to Supabase authentication</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Users className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <div className="text-2xl font-bold text-blue-600">{localAccounts.length}</div>
              <div className="text-sm text-blue-600">Local Accounts</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <div className="text-2xl font-bold text-green-600">
                {Object.values(migrationStatus).filter((s) => s === "success").length}
              </div>
              <div className="text-sm text-green-600">Migrated</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <AlertTriangle className="h-8 w-8 mx-auto text-red-600 mb-2" />
              <div className="text-2xl font-bold text-red-600">
                {Object.values(migrationStatus).filter((s) => s === "error").length}
              </div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant={hasSupabaseConfig ? "default" : "destructive"}>
              {hasSupabaseConfig ? "Supabase Connected" : "Supabase Not Configured"}
            </Badge>
            {!hasSupabaseConfig && (
              <span className="text-sm text-red-600">
                Migration requires Supabase configuration
              </span>
            )}
          </div>

          {isMigrating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Migration Progress</span>
                <span>{Math.round(migrationProgress)}%</span>
              </div>
              <Progress value={migrationProgress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Management */}
      <Card>
        <CardHeader>
          <CardTitle>Local Accounts</CardTitle>
          <CardDescription>Manage and migrate locally stored accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={migrateAllAccounts}
              disabled={!hasSupabaseConfig || isMigrating || localAccounts.length === 0}
              className="bg-servio-purple hover:bg-servio-purple-dark"
            >
              {isMigrating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Migrating...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Migrate All
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={exportAccounts}
              disabled={localAccounts.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={importAccounts}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
            </div>
            <Button variant="outline" onClick={() => setShowPasswords(!showPasswords)}>
              {showPasswords ? (
                <EyeOff className="mr-2 h-4 w-4" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              {showPasswords ? "Hide" : "Show"} Passwords
            </Button>
            <Button
              variant="destructive"
              onClick={clearLocalAccounts}
              disabled={localAccounts.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All
            </Button>
          </div>

          {localAccounts.length === 0 ? (
            <div className="text-center py-8 text-gray-900">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <p>No local accounts found</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {localAccounts.map((account) => (
                <div key={account.contactEmail} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{account.contactName}</h4>
                      <p className="text-sm text-gray-900">{account.contactEmail}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(migrationStatus[account.contactEmail])}
                      <Badge variant="outline">{account.venueType}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Venue:</span> {account.venueName}
                    </div>
                    <div>
                      <span className="font-medium">Created:</span>{" "}
                      {new Date(account.createdAt).toLocaleDateString()}
                    </div>
                    {showPasswords && (
                      <div className="col-span-2">
                        <span className="font-medium">Password:</span>{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {atob(account.passwordHash)}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Migration Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Migration Logs</span>
              <Button variant="outline" size="sm" onClick={() => setShowLogs(!showLogs)}>
                {showLogs ? "Hide" : "Show"} Logs
              </Button>
            </CardTitle>
          </CardHeader>
          {showLogs && (
            <CardContent>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index}>{log}</div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

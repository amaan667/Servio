"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ResetPasswordDebugPage() {
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);

  const captureDebugInfo = () => {
    const info = {

      hashParams: {} as Record<string, string>,
      queryParams: {} as Record<string, string>,
    };

    // Parse hash params
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      hashParams.forEach((value, key) => {
        info.hashParams[key] = value.substring(0, 50) + (value.length > 50 ? "..." : "");

    }

    // Parse query params
    if (window.location.search) {
      const queryParams = new URLSearchParams(window.location.search);
      queryParams.forEach((value, key) => {
        info.queryParams[key] = value.substring(0, 50) + (value.length > 50 ? "..." : "");

    }

    setDebugInfo(info);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Password Reset Debug Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={captureDebugInfo}>Capture Current URL Info</Button>
          {debugInfo && (
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DebugMobilePage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    // Inject Eruda for mobile debugging
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/eruda";
    document.body.appendChild(script);
    script.onload = () => {
      // @ts-expect-error - Eruda is loaded dynamically
      if (window.eruda) {
        // @ts-expect-error - Eruda global
        window.eruda.init();
        // @ts-expect-error - Eruda global
        window.eruda.show();
      }
    };

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const startCapture = () => {
    setIsCapturing(true);
    setLogs([]);

    // Capture console output for debugging
    const originalLog = console.log;
    const originalError = console.error;

    // eslint-disable-next-line no-console
    console.log = (...args) => {
      originalLog(...args);
      setLogs((prev) => [...prev, `[LOG] ${JSON.stringify(args)}`]);
    };

    // eslint-disable-next-line no-console
    console.error = (...args) => {
      originalError(...args);
      setLogs((prev) => [...prev, `[ERROR] ${JSON.stringify(args)}`]);
    };
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const copyLogs = () => {
    const text = logs.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      alert("Logs copied to clipboard!");
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Mobile Safari Debug Console</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p>
                <strong>Instructions:</strong>
              </p>
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                <li>Click "Start Capturing" below</li>
                <li>Click "Go to Sign In" and try signing in</li>
                <li>Come back here to see the logs</li>
                <li>Or use the Eruda console that opened at the bottom</li>
              </ol>
            </div>

            <div className="flex gap-2">
              <Button onClick={startCapture} variant={isCapturing ? "secondary" : "default"}>
                {isCapturing ? "✅ Capturing" : "Start Capturing"}
              </Button>
              <Button onClick={() => (window.location.href = "/sign-in")} variant="outline">
                Go to Sign In
              </Button>
              <Button onClick={clearLogs} variant="outline">
                Clear Logs
              </Button>
              <Button onClick={copyLogs} variant="outline" disabled={logs.length === 0}>
                Copy Logs
              </Button>
            </div>

            <div className="mt-4">
              <h3 className="font-bold mb-2">Captured Logs ({logs.length}):</h3>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs max-h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-gray-500">No logs captured yet...</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-semibold mb-2">Device Info:</p>
              <div className="text-xs font-mono space-y-1">
                <p>User Agent: {navigator.userAgent}</p>
                <p>
                  Mobile Safari:{" "}
                  {(
                    /iPhone|iPad|iPod/.test(navigator.userAgent) &&
                    /Safari/.test(navigator.userAgent) &&
                    !/Chrome|CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
                  ).toString()}
                </p>
                <p>Cookies: {document.cookie.substring(0, 100) || "None"}</p>
                <p>
                  LocalStorage Keys:{" "}
                  {Object.keys(localStorage)
                    .filter((k) => k.includes("sb"))
                    .join(", ") || "None"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

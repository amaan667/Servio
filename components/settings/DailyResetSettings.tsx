"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface DailyResetSettingsProps {
  venueId: string;
  venueName?: string;
  currentResetTime?: string;
}

export function DailyResetSettings({
  venueId,
  venueName = "this venue",
  currentResetTime = "00:00",
}: DailyResetSettingsProps) {
  const [resetTime, setResetTime] = useState(currentResetTime);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResetTime(currentResetTime);
  }, [currentResetTime]);

  const handleSave = async () => {
    if (!resetTime || !venueId) return;

    setIsSaving(true);
    setSaveStatus("idle");
    setError(null);

    try {
      // Validate time format (HH:MM)
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(resetTime)) {
        throw new Error("Please enter a valid time in HH:MM format (24-hour)");
      }

      // Add seconds if not provided
      const timeWithSeconds =
        resetTime.includes(":") && resetTime.split(":").length === 2
          ? `${resetTime}:00`
          : resetTime;

      const response = await fetch("/api/venues/update-reset-time", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          venueId,
          resetTime: timeWithSeconds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update reset time");
      }

      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to update reset time");
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  const formatTimeForDisplay = (time: string) => {
    if (!time) return "00:00";
    const parts = time.split(":");
    const hours = parts[0] ?? "0";
    const minutes = parts[1] ?? "0";
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getNextResetTime = () => {
    if (!resetTime) return "Not set";

    const now = new Date();
    const parts = resetTime.split(":").map(Number);
    const hours = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;

    const nextReset = new Date();
    nextReset.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, set it for tomorrow
    if (nextReset <= now) {
      nextReset.setDate(nextReset.getDate() + 1);
    }

    return nextReset.toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Reset Settings
        </CardTitle>
        <CardDescription>
          Configure when the automatic daily reset should run for {venueName}.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current Settings */}
        <div className="space-y-2">
          <Label htmlFor="reset-time">Reset Time (24-hour format)</Label>
          <div className="flex items-center gap-3">
            <Input
              id="reset-time"
              type="time"
              value={resetTime}
              onChange={(e) => setResetTime(e.target.value)}
              className="w-32"
              disabled={isSaving}
            />
            <span className="text-sm text-gray-900">({formatTimeForDisplay(resetTime)})</span>
          </div>
          <p className="text-xs text-gray-900">
            Enter the time when you want the automatic daily reset to run each day.
          </p>
        </div>

        {/* Next Reset Info */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Next Automatic Reset</span>
          </div>
          <p className="text-sm text-blue-700">{getNextResetTime()}</p>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={isSaving || resetTime === currentResetTime}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>

          {saveStatus === "success" && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Settings saved!</span>
            </div>
          )}

          {saveStatus === "error" && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-900 space-y-1">
          <p>
            <strong>Recommended times:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>00:00 (Midnight)</strong> - Standard reset at start of day
            </li>
            <li>
              <strong>04:00 (4 AM)</strong> - Late night venues that close after midnight
            </li>
            <li>
              <strong>06:00 (6 AM)</strong> - Early morning venues
            </li>
          </ul>
          <p className="mt-2">
            The system will automatically reset within 5 minutes of your chosen time. You can also
            use the manual "Reset" button anytime for immediate reset.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

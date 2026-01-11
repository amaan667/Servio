"use client";

import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface StatusHeaderProps {

}

export function StatusHeader({
  autoRefreshEnabled,
  refreshInterval,
  onToggleAutoRefresh,
  onChangeRefreshInterval,
  tableFilter,
  venueId,
}: StatusHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-3 text-sm text-gray-600">
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-100 text-xs sm:text-sm">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Real-time monitoring
        active
      </span>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm">
        <span>
          • {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long" })} (today)
        </span>
        <span>
          • Current time:{" "}
          {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2 sm:ml-auto">
        <div className="flex items-center gap-2">
          <label className="text-gray-600 text-sm font-medium">Auto-refresh:</label>
          <select
            className="rounded-md border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-200 min-h-[40px] min-w-[60px]"
            value={refreshInterval / 1000}
            onChange={(e) => onChangeRefreshInterval(Number(e.target.value))}
            disabled={!autoRefreshEnabled}
          >
            {[5, 10, 15, 30, 60].map((s) => (
              <option key={s} value={s}>
                {s}s
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 font-medium">Auto-refresh:</span>
          <ToggleSwitch checked={autoRefreshEnabled} onCheckedChange={onToggleAutoRefresh} />
          <span className="text-sm font-medium text-gray-600">
            {autoRefreshEnabled ? "On" : "Off"}
          </span>
        </div>
      </div>

      {tableFilter && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              <span className="text-white font-medium">Filtering by Table {tableFilter}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/${venueId}/live-orders`)}
            >
              Clear Filter
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

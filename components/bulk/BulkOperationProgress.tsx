/**
 * BulkOperationProgress Component
 *
 * Displays progress of bulk operations with status, percentage, and timing.
 */

import React from "react";

export interface BulkOperationProgressProps {
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  total: number;
  completed: number;
  failed: number;
  progress: number;
  elapsedSeconds: number;
  estimatedRemainingSeconds?: number;
  ratePerSecond?: number;
  currentOperation?: string;
  showDetails?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
}

export function BulkOperationProgress({
  status,
  total,
  completed,
  failed,
  progress,
  elapsedSeconds,
  estimatedRemainingSeconds,
  currentOperation,
  showDetails = true,
  onRetry,
  onCancel,
}: BulkOperationProgressProps) {
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getStatusColor = (): string => {
    switch (status) {
      case "pending":
        return "bg-gray-500";
      case "in_progress":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "cancelled":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (): string => {
    switch (status) {
      case "pending":
        return "Pending";
      case "in_progress":
        return "Processing...";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "cancelled":
        return "Cancelled";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="bulk-operation-progress p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${getStatusColor()} ${status === "in_progress" ? "animate-pulse" : ""}`}
          />
          <span className="font-medium">{getStatusText()}</span>
        </div>
        {status === "failed" && onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        )}
        {status === "in_progress" && onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>{progress}% complete</span>
          <span>
            {completed + failed} / {total}
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getStatusColor()} transition-all duration-300`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {currentOperation && <div className="text-sm text-gray-600 mb-3">{currentOperation}</div>}

      {showDetails && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Successful:</span>
            <span className="ml-2 font-medium text-green-600">{completed}</span>
          </div>
          <div>
            <span className="text-gray-500">Failed:</span>
            <span className="ml-2 font-medium text-red-600">{failed}</span>
          </div>
          <div>
            <span className="text-gray-500">Elapsed:</span>
            <span className="ml-2 font-medium">{formatTime(elapsedSeconds)}</span>
          </div>
          {estimatedRemainingSeconds !== undefined && (
            <div>
              <span className="text-gray-500">Est. remaining:</span>
              <span className="ml-2 font-medium">{formatTime(estimatedRemainingSeconds)}</span>
            </div>
          )}
        </div>
      )}

      {status === "failed" && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Some operations failed. Please check the details and retry if needed.
        </div>
      )}
    </div>
  );
}

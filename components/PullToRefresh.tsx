"use client";

import React, { useState } from "react";
import { RefreshCw, CheckCircle } from "lucide-react";
import { usePullToRefresh } from "@/hooks/useGestures";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  className?: string;
}

export default function PullToRefresh({
  onRefresh,
  children,
  threshold = 120,
  className = "",
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const { progress, isPullToRefreshActive, canRefresh } = usePullToRefresh(async () => {
    setIsRefreshing(true);
    setRefreshSuccess(false);

    try {
      await onRefresh();
      setRefreshSuccess(true);

      // Show success state briefly
      setTimeout(() => {
        setRefreshSuccess(false);
      }, 1000);
    } catch (_error) {
      // Error silently handled
    } finally {
      setIsRefreshing(false);
    }
  });

  const rotation = progress * 360;
  const scale = Math.min(1 + progress * 0.2, 1.2);
  const opacity = Math.min(progress * 2, 1);

  return (
    <div className={`relative ${className}`}>
      {/* Pull-to-refresh indicator */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-200 ${
          progress > 0 ? "translate-y-0" : "-translate-y-full"
        }`}
        style={{
          height: `${Math.min(progress * threshold, threshold)}px`,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
        }}
      >
        <div className="flex flex-col items-center justify-center space-y-2" style={{ opacity }}>
          <div
            className="relative"
            style={{
              transform: `scale(${scale})`,
              transition: "transform 0.2s ease-out",
            }}
          >
            {isRefreshing ? (
              <RefreshCw className="h-6 w-6 text-purple-600 animate-spin" />
            ) : refreshSuccess ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <RefreshCw
                className="h-6 w-6 text-purple-600 transition-transform duration-200"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: "center",
                }}
              />
            )}
          </div>

          <div className="text-center">
            {isRefreshing ? (
              <p className="text-sm font-medium text-purple-600">Refreshing...</p>
            ) : refreshSuccess ? (
              <p className="text-sm font-medium text-green-600">Updated!</p>
            ) : canRefresh ? (
              <p className="text-sm font-medium text-purple-600">Release to refresh</p>
            ) : (
              <p className="text-sm text-gray-900">Pull to refresh</p>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-purple-600 z-50 transition-all duration-200"
        style={{
          opacity: progress > 0 ? 1 : 0,
          transform: `scaleX(${progress})`,
          transformOrigin: "left",
        }}
      />

      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  );
}

// Hook for integrating pull-to-refresh with existing components
export function usePullToRefreshWrapper(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (_error) {
      // Error silently handled
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    isRefreshing,
    handleRefresh,
  };
}


/**
 * Connection monitoring and offline handling utilities
 */

import React from "react";

export interface ConnectionState {
  isOnline: boolean;
  isSlowConnection: boolean;
  lastChecked: Date;
}

class ConnectionMonitor {
  private listeners: Set<(state: ConnectionState) => void> = new Set();
  private state: ConnectionState = {
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isSlowConnection: false,
    lastChecked: new Date(),
  };
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window === "undefined") return;

    this.setupEventListeners();
    this.startPeriodicCheck();
  }

  private setupEventListeners() {
    window.addEventListener("online", () => this.handleOnline());
    window.addEventListener("offline", () => this.handleOffline());
  }

  private async handleOnline() {
    await this.checkConnectionQuality();
  }

  private handleOffline() {

    this.updateState({ isOnline: false, isSlowConnection: false });
  }

  private async checkConnectionQuality() {
    try {
      // First check if we're online using navigator.onLine
      if (!navigator.onLine) {
        this.updateState({
          isOnline: false,
          isSlowConnection: false,
          lastChecked: new Date(),
        });
        return;
      }

      const startTime = Date.now();

      // Try to fetch a small resource to test connection quality
      const response = await fetch("/api/auth/health", {
        method: "GET",
        cache: "no-cache",
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });

      const responseTime = Date.now() - startTime;
      const isSlowConnection = responseTime > 1500; // Consider slow if > 1.5 seconds

      // Only update if we get a successful response
      if (response.ok) {
        this.updateState({
          isOnline: true,
          isSlowConnection,
          lastChecked: new Date(),
        });
      } else {
        // If API fails, check navigator.onLine as fallback
        this.updateState({
          isOnline: navigator.onLine,
          isSlowConnection: false,
          lastChecked: new Date(),
        });
      }
    } catch (_error) {

      // Fallback to navigator.onLine
      this.updateState({
        isOnline: navigator.onLine,
        isSlowConnection: false,
        lastChecked: new Date(),
      });
    }
  }

  private updateState(newState: Partial<ConnectionState>) {
    this.state = { ...this.state, ...newState };
    this.listeners.forEach((listener) => listener(this.state));
  }

  private startPeriodicCheck() {
    // Check connection quality every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkConnectionQuality();
    }, 30000);
  }

  public subscribe(listener: (state: ConnectionState) => void): () => void {
    this.listeners.add(listener);

    // Immediately call with current state
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): ConnectionState {
    return { ...this.state };
  }

  public async forceCheck(): Promise<ConnectionState> {
    await this.checkConnectionQuality();
    return this.getState();
  }

  public destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.listeners.clear();
  }
}

// Singleton instance
let connectionMonitor: ConnectionMonitor | null = null;

export function getConnectionMonitor(): ConnectionMonitor {
  if (!connectionMonitor && typeof window !== "undefined") {
    connectionMonitor = new ConnectionMonitor();
  }
  return connectionMonitor!;
}

// React hook for connection monitoring
export function useConnectionMonitor() {
  const [state, setState] = React.useState<ConnectionState>(() => {
    if (typeof window === "undefined") {
      return { isOnline: true, isSlowConnection: false, lastChecked: new Date() };
    }
    return getConnectionMonitor().getState();
  });

  React.useEffect(() => {
    const monitor = getConnectionMonitor();
    const unsubscribe = monitor.subscribe(setState);
    return unsubscribe;
  }, []);

  return state;
}

// Utility to detect if we should use reduced functionality
export function shouldUseOfflineMode(connectionState: ConnectionState): boolean {
  return !connectionState.isOnline || connectionState.isSlowConnection;
}

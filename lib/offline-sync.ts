/**
 * Offline Sync Service
 * Handles queuing and replaying failed requests using Idempotency Keys
 */

import { getConnectionMonitor } from "@/lib/connection-monitor";

export interface SyncItem {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  idempotencyKey: string;
  timestamp: number;
  retries: number;
}

class OfflineSync {
  private queue: SyncItem[] = [];
  private isProcessing = false;

  constructor() {
    if (typeof window === "undefined") return;
    this.loadQueue();
    this.setupMonitor();
  }

  private loadQueue() {
    const saved = localStorage.getItem("servio_sync_queue");
    if (saved) {
      try {
        this.queue = JSON.parse(saved);
      } catch {
        this.queue = [];
      }
    }
  }

  private saveQueue() {
    localStorage.setItem("servio_sync_queue", JSON.stringify(this.queue));
  }

  private setupMonitor() {
    getConnectionMonitor().subscribe((state) => {
      if (state.isOnline && !this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Queue a request for later
   */
  public enqueue(url: string, method: string, body: unknown, headers: Record<string, string> = {}) {
    const idempotencyKey = headers["x-idempotency-key"] || crypto.randomUUID();
    
    const item: SyncItem = {
      id: crypto.randomUUID(),
      url,
      method,
      headers: { ...headers, "x-idempotency-key": idempotencyKey },
      body,
      idempotencyKey,
      timestamp: Date.now(),
      retries: 0
    };

    this.queue.push(item);
    this.saveQueue();
    
    if (getConnectionMonitor().getState().isOnline) {
      this.processQueue();
    }
  }

  /**
   * Process the queue sequentially
   */
  private async processQueue() {
    if (this.queue.length === 0 || this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];
      if (!item) return;
      
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: JSON.stringify(item.body)
        });

        if (response.ok || response.status < 500) {
          // Success or client error (don't retry client errors)
          this.queue.shift();
          this.saveQueue();
        } else {
          // Server error, stop and wait for next check
          break;
        }
      } catch (error) {
        // Network error, stop
        break;
      }
    }

    this.isProcessing = false;
  }
}

export const offlineSync = typeof window !== "undefined" ? new OfflineSync() : null;

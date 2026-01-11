/**
 * Offline queue management for orders and other operations
 * Stores operations locally when offline and syncs when connection is restored
 */

export interface QueuedOperation {
  id: string;
  type: "order" | "payment" | "status_update" | "receipt";
  data: unknown;
  timestamp: number;
  retries: number;
  maxRetries?: number;
}

class OfflineQueue {
  private queue: QueuedOperation[] = [];
  private isProcessing = false;
  private readonly STORAGE_KEY = "servio_offline_queue";
  private readonly MAX_RETRIES = 3;

  constructor() {
    // Only initialize in browser environment
    if (typeof window === "undefined") {
      return;
    }
    this.loadQueue();
    this.setupSyncListener();
  }

  /**
   * Load queue from localStorage
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);

      }
    } catch (error) {

      this.queue = [];
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) { /* Error handled silently */ }
  }

  /**
   * Setup listener for online/offline events
   */
  private setupSyncListener(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("online", () => {

      this.syncQueue();
    });

    // Also check periodically when online
    setInterval(() => {
      if (navigator.onLine && this.queue.length > 0 && !this.isProcessing) {
        this.syncQueue();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Add operation to queue
   */
  async queueOperation(
    type: QueuedOperation["type"],
    data: unknown,
    maxRetries: number = this.MAX_RETRIES
  ): Promise<string> {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const operation: QueuedOperation = {
      id,
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
      maxRetries,
    };

    this.queue.push(operation);
    this.saveQueue();

    // Try to sync immediately if online
    if (navigator.onLine) {
      await this.syncQueue();
    }

    return id;
  }

  /**
   * Sync queue with server
   */
  async syncQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    if (!navigator.onLine) {

      return;
    }

    this.isProcessing = true;

    const operationsToRetry: QueuedOperation[] = [];

    for (const operation of this.queue) {
      try {
        const success = await this.processOperation(operation);

        if (!success && operation.retries < (operation.maxRetries || this.MAX_RETRIES)) {
          operation.retries++;
          operationsToRetry.push(operation);
        } else if (!success) { /* Condition handled */ }
      } catch (error) {

        if (operation.retries < (operation.maxRetries || this.MAX_RETRIES)) {
          operation.retries++;
          operationsToRetry.push(operation);
        }
      }
    }

    // Update queue with retries
    this.queue = operationsToRetry;
    this.saveQueue();

    this.isProcessing = false;

    if (operationsToRetry.length === 0) { /* Condition handled */ } else { /* Else case handled */ }
  }

  /**
   * Process a single operation
   */
  private async processOperation(operation: QueuedOperation): Promise<boolean> {
    try {
      switch (operation.type) {
        case "order":
          return await this.processOrder(operation.data as { order: unknown; endpoint: string });
        case "payment":
          return await this.processPayment(
            operation.data as { payment: unknown; endpoint: string }
          );
        case "status_update":
          return await this.processStatusUpdate(
            operation.data as { orderId: string; status: string; endpoint: string }
          );
        case "receipt":
          return await this.processReceipt(
            operation.data as { orderId: string; email?: string; phone?: string; endpoint: string }
          );
        default:

          return false;
      }
    } catch (error) {

      return false;
    }
  }

  /**
   * Process order operation
   */
  private async processOrder(data: { order: unknown; endpoint: string }): Promise<boolean> {
    const response = await fetch(data.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data.order),
    });

    return response.ok;
  }

  /**
   * Process payment operation
   */
  private async processPayment(data: { payment: unknown; endpoint: string }): Promise<boolean> {
    const response = await fetch(data.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data.payment),
    });

    return response.ok;
  }

  /**
   * Process status update operation
   */
  private async processStatusUpdate(data: {
    orderId: string;
    status: string;
    endpoint: string;
    paymentStatus?: string;
    paymentMethod?: string;
  }): Promise<boolean> {
    // Handle payment status updates (POST to /api/orders/update-payment-status)
    if (data.endpoint.includes("update-payment-status")) {
      const response = await fetch(data.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: data.orderId,
          paymentStatus: data.paymentStatus || data.status,
          paymentMethod: data.paymentMethod,
        }),
      });
      return response.ok;
    }

    // Handle order status updates (PATCH)
    const response = await fetch(data.endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: data.orderId, status: data.status }),
    });

    return response.ok;
  }

  /**
   * Process receipt operation
   */
  private async processReceipt(data: {
    orderId: string;
    email?: string;
    phone?: string;
    endpoint: string;
    venueId?: string;
  }): Promise<boolean> {
    const body: { orderId: string; email?: string; phone?: string; venueId?: string } = {
      orderId: data.orderId,
      venueId: data.venueId || "",
    };

    if (data.email) body.email = data.email;
    if (data.phone) body.phone = data.phone;

    const response = await fetch(data.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return response.ok;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { count: number; oldestTimestamp: number | null } {
    if (this.queue.length === 0) {
      return { count: 0, oldestTimestamp: null };
    }

    const oldest = Math.min(...this.queue.map((op) => op.timestamp));
    return {
      count: this.queue.length,
      oldestTimestamp: oldest,
    };
  }

  /**
   * Clear queue (use with caution)
   */
  clearQueue(): void {
    this.queue = [];
    this.saveQueue();

  }
}

// Singleton instance
let offlineQueueInstance: OfflineQueue | null = null;

export function getOfflineQueue(): OfflineQueue {
  if (typeof window === "undefined") {
    // Return a no-op instance for SSR
    return {
      queueOperation: async () => "",
      syncQueue: async () => { /* Intentionally empty */ },
      getQueueStatus: () => ({ count: 0, oldestTimestamp: null }),
      clearQueue: () => { /* Intentionally empty */ },
    } as unknown as OfflineQueue;
  }
  if (!offlineQueueInstance) {
    offlineQueueInstance = new OfflineQueue();
  }
  return offlineQueueInstance;
}

/**
 * Queue an order when offline
 */
export async function queueOrder(order: unknown, endpoint: string): Promise<string> {
  const queue = getOfflineQueue();
  return queue.queueOperation("order", { order, endpoint });
}

/**
 * Queue a payment when offline
 */
export async function queuePayment(payment: unknown, endpoint: string): Promise<string> {
  const queue = getOfflineQueue();
  return queue.queueOperation("payment", { payment, endpoint });
}

/**
 * Queue a status update when offline
 */
export async function queueStatusUpdate(
  orderId: string,
  status: string,
  endpoint: string,
  paymentStatus?: string,
  paymentMethod?: string
): Promise<string> {
  const queue = getOfflineQueue();
  return queue.queueOperation("status_update", {
    orderId,
    status,
    endpoint,
    paymentStatus,
    paymentMethod,
  });
}

/**
 * Queue a receipt send when offline
 */
export async function queueReceipt(
  orderId: string,
  endpoint: string,
  email?: string,
  phone?: string
): Promise<string> {
  const queue = getOfflineQueue();
  return queue.queueOperation("receipt", { orderId, endpoint, email, phone });
}

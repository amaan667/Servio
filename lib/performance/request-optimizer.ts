// Request deduplication and batching for optimal network performance

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest<unknown>>();
  private dedupWindow = 100; // 100ms deduplication window

  async deduplicate<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const pending = this.pendingRequests.get(key);

    // Return existing request if within dedup window
    if (pending && now - pending.timestamp < this.dedupWindow) {
      return pending.promise as Promise<T>;
    }

    // Create new request
    const promise = fetcher().finally(() => {
      // Clean up after request completes
      setTimeout(() => {
        this.pendingRequests.delete(key);
      }, this.dedupWindow);
    });

    this.pendingRequests.set(key, {
      promise,
      timestamp: now,
    });

    return promise;
  }

  clear(): void {
    this.pendingRequests.clear();
  }
}

// Request batcher for combining multiple requests
class RequestBatcher {
  private batches = new Map<
    string,
    Array<{ id: string; resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>
  >();
  private batchTimeout = 50; // 50ms batch window
  private batchTimers = new Map<string, NodeJS.Timeout>();

  async batch<T>(
    batchKey: string,
    itemId: string,
    batchFetcher: (ids: string[]) => Promise<Record<string, T>>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const resolveUnknown = (value: unknown) => resolve(value as T);
      // Add to batch
      if (!this.batches.has(batchKey)) {
        this.batches.set(batchKey, []);
      }

      this.batches.get(batchKey)!.push({ id: itemId, resolve: resolveUnknown, reject });

      // Clear existing timer
      if (this.batchTimers.has(batchKey)) {
        clearTimeout(this.batchTimers.get(batchKey)!);
      }

      // Set new timer to execute batch
      const timer = setTimeout(async () => {
        const batch = this.batches.get(batchKey) || [];
        this.batches.delete(batchKey);
        this.batchTimers.delete(batchKey);

        if (batch.length === 0) return;

        try {
          const ids = batch.map((item) => item.id);
          const results = await batchFetcher(ids);

          // Resolve individual promises
          batch.forEach((item) => {
            if (results[item.id]) {
              item.resolve(results[item.id]);
            } else {
              item.reject(new Error(`No result for ${item.id}`));
            }
          });
        } catch (_error) {
          // Reject all promises in batch
          batch.forEach((item) => item.reject(_error));
        }
      }, this.batchTimeout);

      this.batchTimers.set(batchKey, timer);
    });
  }

  clear(): void {
    this.batchTimers.forEach((timer) => clearTimeout(timer));
    this.batches.clear();
    this.batchTimers.clear();
  }
}

// Export singleton instances
export const requestDeduplicator = new RequestDeduplicator();
export const requestBatcher = new RequestBatcher();

// Helper function for deduplicating fetch requests
export async function deduplicatedFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const key = `${url}-${JSON.stringify(
    options ||
      {
        /* Empty */
      }
  )}`;

  return requestDeduplicator.deduplicate(key, async () => {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  });
}

// Helper function for batching multiple item requests
export async function batchedItemFetch<T>(
  batchKey: string,
  itemId: string,
  fetchMultiple: (ids: string[]) => Promise<Record<string, T>>
): Promise<T> {
  return requestBatcher.batch(batchKey, itemId, fetchMultiple);
}

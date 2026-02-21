// ============================================================================
// SUPABASE CONNECTION POOL MANAGEMENT
// Prevents connection exhaustion under load
// ============================================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface PooledClientOptions {
  maxConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  maxRetries?: number;
}

export interface ConnectionStats {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  waitingRequests: number;
  avgWaitTime: number;
}

interface PendingRequest {
  resolve: (client: SupabaseClient) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export class SupabaseConnectionPool {
  private pool: SupabaseClient[] = [];
  private waitingQueue: PendingRequest[] = [];
  private stats = {
    activeConnections: 0,
    idleConnections: 0,
    totalConnections: 0,
    waitingRequests: 0,
    totalWaitTime: 0,
    totalAcquisitions: 0,
  };

  constructor(
    private supabaseUrl: string,
    private supabaseKey: string,
    private options: PooledClientOptions = {}
  ) {
    this.options.maxConnections ??= 10;
    this.options.connectionTimeout ??= 30000;
    this.options.idleTimeout ??= 60000;
    this.options.maxRetries ??= 3;

    this.startCleanupInterval();
  }

  async acquire(): Promise<SupabaseClient> {
    const idleClient = this.pool.find(() => true);
    if (idleClient) {
      this.stats.activeConnections++;
      this.stats.idleConnections--;
      return idleClient;
    }

    if (this.stats.totalConnections < this.options.maxConnections!) {
      const client = this.createClient();
      this.pool.push(client);
      this.stats.totalConnections++;
      this.stats.activeConnections++;
      return client;
    }

    return this.waitForConnection();
  }

  async release(client: SupabaseClient): Promise<void> {
    const index = this.pool.indexOf(client);
    if (index === -1) {
      this.stats.totalConnections--;
      return;
    }

    this.stats.activeConnections--;
    this.stats.idleConnections++;

    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift()!;
      waiting.resolve(client);
      this.stats.waitingRequests--;
      this.stats.totalAcquisitions++;
      this.stats.totalWaitTime += Date.now() - waiting.timestamp;
    }
  }

  async remove(client: SupabaseClient): Promise<void> {
    const index = this.pool.indexOf(client);
    if (index !== -1) {
      this.pool.splice(index, 1);
      this.stats.totalConnections--;
      if (this.stats.activeConnections > 0) {
        this.stats.activeConnections--;
      }
    }
  }

  getStats(): ConnectionStats {
    return {
      activeConnections: this.stats.activeConnections,
      idleConnections: this.stats.idleConnections,
      totalConnections: this.stats.totalConnections,
      waitingRequests: this.stats.waitingRequests,
      avgWaitTime:
        this.stats.totalAcquisitions > 0
          ? this.stats.totalWaitTime / this.stats.totalAcquisitions
          : 0,
    };
  }

  async close(): Promise<void> {
    this.pool = [];
    this.stats.totalConnections = 0;
    this.stats.activeConnections = 0;
    this.stats.idleConnections = 0;
  }

  private createClient(): SupabaseClient {
    return createClient(this.supabaseUrl, this.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  private waitForConnection(): Promise<SupabaseClient> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(
          (w) => w.timestamp === this.waitingQueue[this.waitingQueue.length - 1]?.timestamp
        );
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
          this.stats.waitingRequests--;
        }
        reject(new Error("Connection timeout"));
      }, this.options.connectionTimeout);

      this.waitingQueue.push({
        resolve: (client: SupabaseClient) => {
          clearTimeout(timeout);
          resolve(client);
        },
        reject,
        timestamp: Date.now(),
      });
      this.stats.waitingRequests++;
    });
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.stats.idleConnections = this.pool.length - this.stats.activeConnections;
    }, this.options.idleTimeout! / 2);
  }
}

let poolInstance: SupabaseConnectionPool | null = null;

export function getConnectionPool(): SupabaseConnectionPool {
  if (!poolInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Supabase URL and key must be set");
    }

    poolInstance = new SupabaseConnectionPool(url, key);
  }

  return poolInstance;
}

export function initConnectionPool(
  url: string,
  key: string,
  options?: PooledClientOptions
): SupabaseConnectionPool {
  poolInstance = new SupabaseConnectionPool(url, key, options);
  return poolInstance;
}

export interface ReplicaConfig {
  primary: { url: string; key: string };
  replicas: Array<{ url: string; key: string; region?: string }>;
}

export class ReadReplicaRouter {
  private replicas: SupabaseConnectionPool[];
  private primary: SupabaseConnectionPool;

  constructor(config: ReplicaConfig) {
    this.primary = new SupabaseConnectionPool(config.primary.url, config.primary.key);
    this.replicas = config.replicas.map((r) => new SupabaseConnectionPool(r.url, r.key));
  }

  getReplica(): SupabaseConnectionPool {
    const index = Math.floor(Math.random() * this.replicas.length);
    return this.replicas[index]!;
  }

  getPrimary(): SupabaseConnectionPool {
    return this.primary;
  }
}

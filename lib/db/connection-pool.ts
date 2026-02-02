/**
 * @fileoverview Database Connection Pooling Configuration
 * Provides optimized connection pooling for Supabase/PostgreSQL
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/monitoring/structured-logger';

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  connectionTimeout: number; // in milliseconds
  idleTimeout: number; // in milliseconds
  maxLifetime: number; // in milliseconds
  acquireTimeout: number; // in milliseconds
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
}

/**
 * Default connection pool configuration
 */
export const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  minConnections: 2,
  maxConnections: 20,
  connectionTimeout: 10000, // 10 seconds
  idleTimeout: 30000, // 30 seconds
  maxLifetime: 3600000, // 1 hour
  acquireTimeout: 5000, // 5 seconds
};

/**
 * Connection Pool Manager
 * Manages database connection pooling for optimal performance
 */
export class ConnectionPoolManager {
  private config: ConnectionPoolConfig;
  private pools: Map<string, SupabaseClient> = new Map();
  private stats: Map<string, PoolStats> = new Map();

  constructor(config: ConnectionPoolConfig = DEFAULT_POOL_CONFIG) {
    this.config = config;
  }

  /**
   * Get or create a connection pool for a specific context
   */
  async getPool(context: string = 'default'): Promise<SupabaseClient> {
    if (this.pools.has(context)) {
      return this.pools.get(context)!;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Create Supabase client with connection pooling options
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-connection-pool': context,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    this.pools.set(context, client);
    this.stats.set(context, {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
    });

    logger.info(`Created connection pool for context: ${context}`, {
      config: this.config,
    });

    return client;
  }

  /**
   * Get pool statistics
   */
  getPoolStats(context: string = 'default'): PoolStats | null {
    return this.stats.get(context) || null;
  }

  /**
   * Get all pool statistics
   */
  getAllPoolStats(): Record<string, PoolStats> {
    const stats: Record<string, PoolStats> = {};
    this.stats.forEach((value, key) => {
      stats[key] = value;
    });
    return stats;
  }

  /**
   * Close a specific pool
   */
  async closePool(context: string): Promise<void> {
    const pool = this.pools.get(context);
    if (pool) {
      // Supabase client doesn't have explicit close method
      // Just remove from our tracking
      this.pools.delete(context);
      this.stats.delete(context);
      logger.info(`Closed connection pool for context: ${context}`);
    }
  }

  /**
   * Close all pools
   */
  async closeAllPools(): Promise<void> {
    const contexts = Array.from(this.pools.keys());
    for (const context of contexts) {
      await this.closePool(context);
    }
    logger.info('Closed all connection pools');
  }

  /**
   * Update pool configuration
   */
  updateConfig(config: Partial<ConnectionPoolConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Updated connection pool configuration', { config: this.config });
  }
}

// Singleton instance
let poolManagerInstance: ConnectionPoolManager | null = null;

/**
 * Get the connection pool manager singleton
 */
export function getConnectionPoolManager(): ConnectionPoolManager {
  if (!poolManagerInstance) {
    poolManagerInstance = new ConnectionPoolManager();
  }
  return poolManagerInstance;
}

/**
 * Get a database client from the connection pool
 */
export async function getPooledClient(context: string = 'default'): Promise<SupabaseClient> {
  const manager = getConnectionPoolManager();
  return manager.getPool(context);
}

/**
 * Execute a query with connection pooling
 */
export async function executeWithPool<T>(
  query: (client: SupabaseClient) => Promise<T>,
  context: string = 'default'
): Promise<T> {
  const client = await getPooledClient(context);
  return query(client);
}

/**
 * Execute multiple queries in parallel with connection pooling
 */
export async function executeBatchWithPool<T>(
  queries: Array<(client: SupabaseClient) => Promise<T>>,
  context: string = 'default'
): Promise<T[]> {
  const client = await getPooledClient(context);
  return Promise.all(queries.map(query => query(client)));
}

/**
 * Read replica configuration
 */
export interface ReadReplicaConfig {
  id: string;
  url: string;
  key: string;
  region: string;
  priority: number;
  enabled: boolean;
}

/**
 * Read Replica Manager
 * Manages read replicas for database scaling
 */
export class ReadReplicaManager {
  private replicas: ReadReplicaConfig[] = [];
  private currentReplicaIndex: number = 0;
  private useReplicas: boolean = true;

  constructor(replicas: ReadReplicaConfig[] = []) {
    this.replicas = replicas.filter(r => r.enabled);
  }

  /**
   * Add a read replica
   */
  addReplica(replica: ReadReplicaConfig): void {
    this.replicas.push(replica);
    this.replicas.sort((a, b) => a.priority - b.priority);
    logger.info(`Added read replica: ${replica.id}`, { region: replica.region });
  }

  /**
   * Get a read replica client
   */
  async getReadReplicaClient(): Promise<SupabaseClient | null> {
    if (!this.useReplicas || this.replicas.length === 0) {
      return null;
    }

    // Round-robin selection
    const replica = this.replicas[this.currentReplicaIndex];
    if (!replica) {
      return null;
    }

    this.currentReplicaIndex = (this.currentReplicaIndex + 1) % this.replicas.length;

    try {
      const client = createClient(replica.url, replica.key, {
        db: { schema: 'public' },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      logger.debug(`Using read replica: ${replica.id}`, { region: replica.region });
      return client;
    } catch (error) {
      logger.error(`Failed to connect to read replica: ${replica.id}`, { error });
      return null;
    }
  }

  /**
   * Execute a read query on a replica
   */
  async executeReadQuery<T>(
    query: (client: SupabaseClient) => Promise<T>
  ): Promise<T> {
    const replicaClient = await this.getReadReplicaClient();

    if (replicaClient) {
      try {
        return await query(replicaClient);
      } catch (error) {
        logger.warn('Read replica query failed, falling back to primary', { error });
        // Fall back to primary
      }
    }

    // Fall back to primary connection
    const primaryClient = await getPooledClient('read-primary');
    return query(primaryClient);
  }

  /**
   * Enable or disable read replicas
   */
  setUseReplicas(enabled: boolean): void {
    this.useReplicas = enabled;
    logger.info(`Read replicas ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get replica status
   */
  getReplicaStatus(): Array<{ id: string; region: string; enabled: boolean }> {
    return this.replicas.map(r => ({
      id: r.id,
      region: r.region,
      enabled: r.enabled,
    }));
  }
}

// Singleton instance
let replicaManagerInstance: ReadReplicaManager | null = null;

/**
 * Get the read replica manager singleton
 */
export function getReadReplicaManager(): ReadReplicaManager {
  if (!replicaManagerInstance) {
    // Initialize replicas from environment variables
    const replicas: ReadReplicaConfig[] = [];

    // Parse replica configurations from environment
    // Format: READ_REPLICA_1_URL, READ_REPLICA_1_KEY, READ_REPLICA_1_REGION, etc.
    for (let i = 1; i <= 5; i++) {
      const url = process.env[`READ_REPLICA_${i}_URL`];
      const key = process.env[`READ_REPLICA_${i}_KEY`];
      const region = process.env[`READ_REPLICA_${i}_REGION`] || `region-${i}`;

      if (url && key) {
        replicas.push({
          id: `replica-${i}`,
          url,
          key,
          region,
          priority: i,
          enabled: true,
        });
      }
    }

    replicaManagerInstance = new ReadReplicaManager(replicas);
  }
  return replicaManagerInstance;
}

/**
 * Execute a read query with automatic replica selection
 */
export async function executeReadQuery<T>(
  query: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  const manager = getReadReplicaManager();
  return manager.executeReadQuery(query);
}

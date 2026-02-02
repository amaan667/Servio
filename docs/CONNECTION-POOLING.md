# Connection Pooling Configuration

This document describes the implementation of connection pooling configuration for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Configuration](#configuration)
4. [Monitoring](#monitoring)
5. [Best Practices](#best-practices)

## Overview

Connection pooling is a technique to manage database connections efficiently, reducing the overhead of creating and destroying connections:

- **Reduced Overhead:** Reduce overhead of creating connections
- **Improved Performance:** Improve performance by reusing connections
- **Resource Management:** Manage database resources efficiently
- **Scalability:** Scale database connections effectively

## Features

### Configuration

```typescript
// lib/db/connection-pool.ts
import { Pool, PoolConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

export interface ConnectionPoolConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  max: number;
  min: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  acquireTimeoutMillis: number;
  maxUses: number;
  maxLifetime: number;
  statementTimeout: number;
  queryTimeout: number;
}

export const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'servio',
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 2000, // 2 seconds
  acquireTimeoutMillis: 10000, // 10 seconds
  maxUses: 7500,
  maxLifetime: 1800000, // 30 minutes
  statementTimeout: 30000, // 30 seconds
  queryTimeout: 30000, // 30 seconds
};

export class ConnectionPoolManager {
  private pools: Map<string, Pool> = new Map();
  private config: ConnectionPoolConfig;

  constructor(config: ConnectionPoolConfig = DEFAULT_POOL_CONFIG) {
    this.config = config;
  }

  getPool(name: string = 'default'): Pool {
    if (!this.pools.has(name)) {
      const pool = this.createPool(this.config);
      this.pools.set(name, pool);
    }

    return this.pools.get(name)!;
  }

  private createPool(config: ConnectionPoolConfig): Pool {
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: config.max,
      min: config.min,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      statement_timeout: config.statementTimeout,
      query_timeout: config.queryTimeout,
    };

    const pool = new Pool(poolConfig);

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    // Log pool events
    pool.on('connect', () => {
      console.log('New client connected');
    });

    pool.on('remove', () => {
      console.log('Client removed');
    });

    return pool;
  }

  async getStats(name: string = 'default'): Promise<PoolStats> {
    const pool = this.getPool(name);

    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      max: pool.options.max as number,
      min: pool.options.min as number,
    };
  }

  async closeAll(): Promise<void> {
    for (const [name, pool] of this.pools) {
      console.log(`Closing pool: ${name}`);
      await pool.end();
    }

    this.pools.clear();
  }
}

interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  max: number;
  min: number;
}

// Singleton instance
let poolManager: ConnectionPoolManager | null = null;

export function getConnectionPoolManager(): ConnectionPoolManager {
  if (!poolManager) {
    poolManager = new ConnectionPoolManager();
  }

  return poolManager;
}

export function getDatabase(name: string = 'default'): any {
  const poolManager = getConnectionPoolManager();
  const pool = poolManager.getPool(name);

  return drizzle(pool);
}
```

### Environment-Specific Configuration

```typescript
// lib/db/config.ts
import { ConnectionPoolConfig } from './connection-pool';

export function getPoolConfig(): ConnectionPoolConfig {
  const environment = process.env.NODE_ENV || 'development';

  switch (environment) {
    case 'production':
      return {
        host: process.env.DB_HOST!,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME!,
        username: process.env.DB_USERNAME!,
        password: process.env.DB_PASSWORD!,
        max: 50,
        min: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        acquireTimeoutMillis: 10000,
        maxUses: 7500,
        maxLifetime: 1800000,
        statementTimeout: 30000,
        queryTimeout: 30000,
      };

    case 'staging':
      return {
        host: process.env.DB_HOST!,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME!,
        username: process.env.DB_USERNAME!,
        password: process.env.DB_PASSWORD!,
        max: 20,
        min: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        acquireTimeoutMillis: 10000,
        maxUses: 7500,
        maxLifetime: 1800000,
        statementTimeout: 30000,
        queryTimeout: 30000,
      };

    case 'development':
    default:
      return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'servio',
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || '',
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        acquireTimeoutMillis: 10000,
        maxUses: 7500,
        maxLifetime: 1800000,
        statementTimeout: 30000,
        queryTimeout: 30000,
      };
  }
}
```

## Monitoring

### Pool Monitoring

```typescript
// lib/db/pool-monitor.ts
import { getConnectionPoolManager } from './connection-pool';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

export class PoolMonitor {
  private interval: NodeJS.Timeout | null = null;

  start(intervalMs: number = 60000): void {
    console.log('Starting pool monitor...');

    this.interval = setInterval(async () => {
      await this.collectMetrics();
    }, intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log('Pool monitor stopped');
  }

  async collectMetrics(): Promise<void> {
    const poolManager = getConnectionPoolManager();
    const stats = await poolManager.getStats();

    console.log('Pool stats:', stats);

    // Send metrics to CloudWatch
    await this.sendMetrics(stats);
  }

  async sendMetrics(stats: any): Promise<void> {
    const command = new PutMetricDataCommand({
      Namespace: 'Servio/Database',
      MetricData: [
        {
          MetricName: 'PoolTotalCount',
          Value: stats.totalCount,
          Unit: 'Count',
        },
        {
          MetricName: 'PoolIdleCount',
          Value: stats.idleCount,
          Unit: 'Count',
        },
        {
          MetricName: 'PoolWaitingCount',
          Value: stats.waitingCount,
          Unit: 'Count',
        },
        {
          MetricName: 'PoolUtilization',
          Value: (stats.totalCount / stats.max) * 100,
          Unit: 'Percent',
        },
      ],
    });

    await cloudwatch.send(command);
  }
}

// Singleton instance
let poolMonitor: PoolMonitor | null = null;

export function getPoolMonitor(): PoolMonitor {
  if (!poolMonitor) {
    poolMonitor = new PoolMonitor();
  }

  return poolMonitor;
}
```

### Health Check

```typescript
// lib/db/health-check.ts
import { getConnectionPoolManager } from './connection-pool';

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const poolManager = getConnectionPoolManager();
  const pool = poolManager.getPool();

  try {
    const client = await pool.connect();

    try {
      // Check if database is responsive
      const result = await client.query('SELECT 1 as health_check');

      if (result.rows[0].health_check !== 1) {
        return {
          healthy: false,
          error: 'Health check failed',
        };
      }

      // Check pool stats
      const stats = await poolManager.getStats();

      // Check if pool is exhausted
      if (stats.totalCount >= stats.max) {
        return {
          healthy: false,
          error: 'Pool exhausted',
        };
      }

      // Check if there are too many waiting connections
      if (stats.waitingCount > 10) {
        return {
          healthy: false,
          error: 'Too many waiting connections',
        };
      }

      return {
        healthy: true,
        stats,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database health check failed:', error);

    return {
      healthy: false,
      error: error.message,
    };
  }
}

interface HealthCheckResult {
  healthy: boolean;
  error?: string;
  stats?: any;
}
```

## Best Practices

### 1. Set Appropriate Pool Size

Set appropriate pool size:

```typescript
// Good: Appropriate pool size
const config = {
  max: 50, // Based on database capacity
  min: 10, // Minimum connections to keep
};

// Bad: Too small pool size
const config = {
  max: 5, // Too small
  min: 1,
};

// Bad: Too large pool size
const config = {
  max: 1000, // Too large
  min: 100,
};
```

### 2. Set Appropriate Timeouts

Set appropriate timeouts:

```typescript
// Good: Appropriate timeouts
const config = {
  connectionTimeoutMillis: 2000, // 2 seconds
  acquireTimeoutMillis: 10000, // 10 seconds
  statementTimeout: 30000, // 30 seconds
  queryTimeout: 30000, // 30 seconds
};

// Bad: Too short timeouts
const config = {
  connectionTimeoutMillis: 100, // Too short
  acquireTimeoutMillis: 1000,
  statementTimeout: 1000,
  queryTimeout: 1000,
};

// Bad: Too long timeouts
const config = {
  connectionTimeoutMillis: 60000, // Too long
  acquireTimeoutMillis: 120000,
  statementTimeout: 300000,
  queryTimeout: 300000,
};
```

### 3. Set Appropriate Idle Timeout

Set appropriate idle timeout:

```typescript
// Good: Appropriate idle timeout
const config = {
  idleTimeoutMillis: 30000, // 30 seconds
};

// Bad: Too short idle timeout
const config = {
  idleTimeoutMillis: 1000, // Too short
};

// Bad: Too long idle timeout
const config = {
  idleTimeoutMillis: 600000, // Too long
};
```

### 4. Monitor Pool Stats

Monitor pool stats:

```typescript
// Good: Monitor pool stats
const stats = await poolManager.getStats();
console.log('Pool stats:', stats);

// Bad: No monitoring
// No monitoring
```

### 5. Handle Pool Errors

Handle pool errors:

```typescript
// Good: Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Bad: No error handling
// No error handling
```

### 6. Use Environment-Specific Configuration

Use environment-specific configuration:

```typescript
// Good: Environment-specific configuration
const config = getPoolConfig();

// Bad: Same configuration for all environments
const config = {
  max: 20,
  min: 5,
};
```

### 7. Document Pool Configuration

Document pool configuration:

```markdown
# Good: Document pool configuration
## Pool Configuration

- Production: max=50, min=10
- Staging: max=20, min=5
- Development: max=10, min=2

# Bad: No documentation
# No documentation
```

## References

- [Connection Pooling](https://node-postgres.com/features/pooling)
- [PostgreSQL Connection Pooling](https://www.postgresql.org/docs/current/pgpool.html)
- [Database Connection Pooling](https://aws.amazon.com/blogs/database/best-practices-for-working-with-postgresql/)
- [Connection Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)

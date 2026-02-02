# Database Read Replicas for Scaling

This document describes the implementation of database read replicas for scaling the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Infrastructure](#infrastructure)
4. [Configuration](#configuration)
5. [Routing](#routing)
6. [Best Practices](#best-practices)

## Overview

Database read replicas allow you to scale read operations by creating read-only copies of your primary database:

- **Read Scaling:** Scale read operations horizontally
- **Reduced Load:** Reduce load on primary database
- **Improved Performance:** Improve read performance
- **High Availability:** Improve availability for read operations

## Features

### Infrastructure Setup

```yaml
# terraform/read-replicas/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# Primary Database
resource "aws_db_instance" "primary" {
  identifier           = "servio-primary"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.r6g.xlarge"
  allocated_storage    = 100
  storage_type         = "gp3"
  storage_encrypted    = true
  db_name              = "servio"
  username             = var.db_username
  password             = var.db_password
  parameter_group_name = aws_db_parameter_group.servio.name
  vpc_security_group_ids = [aws_security_group.database.id]
  db_subnet_group_name = aws_db_subnet_group.servio.name
  multi_az             = true
  backup_retention_period = 30
  backup_window        = "02:00-03:00"
  maintenance_window   = "Mon:03:00-Mon:04:00"
  performance_insights_enabled = true
  monitoring_interval  = 60
  monitoring_role_arn  = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  skip_final_snapshot  = false
  final_snapshot_identifier = "servio-primary-final"

  tags = {
    Name        = "servio-primary"
    Environment = "production"
    Role        = "primary"
  }
}

# Read Replicas
resource "aws_db_instance" "replica" {
  count                = 2
  identifier           = "servio-replica-${count.index + 1}"
  replicate_source_db  = aws_db_instance.primary.identifier
  instance_class       = "db.r6g.large"
  parameter_group_name = aws_db_parameter_group.servio.name
  vpc_security_group_ids = [aws_security_group.database.id]
  monitoring_interval  = 60
  monitoring_role_arn  = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = true
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Name        = "servio-replica-${count.index + 1}"
    Environment = "production"
    Role        = "replica"
  }
}

# Parameter Group
resource "aws_db_parameter_group" "servio" {
  name   = "servio-parameter-group"
  family = "postgres15"

  parameter {
    name  = "max_connections"
    value = "200"
  }

  parameter {
    name  = "shared_buffers"
    value = "256MB"
  }

  parameter {
    name  = "effective_cache_size"
    value = "1GB"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "64MB"
  }

  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }

  parameter {
    name  = "wal_buffers"
    value = "16MB"
  }

  parameter {
    name  = "default_statistics_target"
    value = "100"
  }

  parameter {
    name  = "random_page_cost"
    value = "1.1"
  }

  parameter {
    name  = "effective_io_concurrency"
    value = "200"
  }

  parameter {
    name  = "work_mem"
    value = "2621kB"
  }

  parameter {
    name  = "min_wal_size"
    value = "1GB"
  }

  parameter {
    name  = "max_wal_size"
    value = "4GB"
  }
}

# Subnet Group
resource "aws_db_subnet_group" "servio" {
  name       = "servio-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "servio-subnet-group"
  }
}

# Security Group
resource "aws_security_group" "database" {
  name        = "servio-database-sg"
  description = "Security group for Servio database"
  vpc_id      = aws_vpc.production.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.production.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "servio-database-sg"
  }
}

# IAM Role for RDS Monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "servio-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
```

### Database Configuration

```typescript
// lib/db/read-replicas.ts
import { Pool, PoolConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

export interface DatabaseConfig {
  primary: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  replicas: Array<{
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }>;
}

export class DatabaseManager {
  private primaryPool: Pool;
  private replicaPools: Pool[];
  private currentReplicaIndex = 0;

  constructor(config: DatabaseConfig) {
    // Create primary pool
    this.primaryPool = this.createPool(config.primary);

    // Create replica pools
    this.replicaPools = config.replicas.map(replica => this.createPool(replica));
  }

  private createPool(config: any): Pool {
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    return new Pool(poolConfig);
  }

  getPrimary(): any {
    return drizzle(this.primaryPool);
  }

  getReplica(): any {
    // Round-robin load balancing
    const pool = this.replicaPools[this.currentReplicaIndex];
    this.currentReplicaIndex = (this.currentReplicaIndex + 1) % this.replicaPools.length;

    return drizzle(pool);
  }

  getReplicas(): any[] {
    return this.replicaPools.map(pool => drizzle(pool));
  }

  async query(sql: string, params?: any[], options?: { useReplica?: boolean }): Promise<any> {
    const db = options?.useReplica ? this.getReplica() : this.getPrimary();

    return db.execute(sql, params);
  }

  async transaction<T>(callback: (db: any) => Promise<T>): Promise<T> {
    const db = this.getPrimary();

    return db.transaction(callback);
  }

  async close(): Promise<void> {
    await this.primaryPool.end();

    for (const pool of this.replicaPools) {
      await pool.end();
    }
  }
}

// Singleton instance
let databaseManager: DatabaseManager | null = null;

export function getDatabaseManager(): DatabaseManager {
  if (!databaseManager) {
    const config: DatabaseConfig = {
      primary: {
        host: process.env.DB_PRIMARY_HOST!,
        port: parseInt(process.env.DB_PRIMARY_PORT || '5432'),
        database: process.env.DB_NAME!,
        username: process.env.DB_USERNAME!,
        password: process.env.DB_PASSWORD!,
      },
      replicas: [
        {
          host: process.env.DB_REPLICA_1_HOST!,
          port: parseInt(process.env.DB_REPLICA_1_PORT || '5432'),
          database: process.env.DB_NAME!,
          username: process.env.DB_USERNAME!,
          password: process.env.DB_PASSWORD!,
        },
        {
          host: process.env.DB_REPLICA_2_HOST!,
          port: parseInt(process.env.DB_REPLICA_2_PORT || '5432'),
          database: process.env.DB_NAME!,
          username: process.env.DB_USERNAME!,
          password: process.env.DB_PASSWORD!,
        },
      ],
    };

    databaseManager = new DatabaseManager(config);
  }

  return databaseManager;
}
```

## Configuration

### Environment Variables

```bash
# .env.production
# Primary Database
DB_PRIMARY_HOST=servio-primary.xxxxx.us-east-1.rds.amazonaws.com
DB_PRIMARY_PORT=5432
DB_NAME=servio
DB_USERNAME=servio
DB_PASSWORD=your_password

# Read Replicas
DB_REPLICA_1_HOST=servio-replica-1.xxxxx.us-east-1.rds.amazonaws.com
DB_REPLICA_1_PORT=5432
DB_REPLICA_2_HOST=servio-replica-2.xxxxx.us-east-1.rds.amazonaws.com
DB_REPLICA_2_PORT=5432
```

### Service Layer Integration

```typescript
// lib/services/BaseService.ts
import { getDatabaseManager } from '../db/read-replicas';

export abstract class BaseService {
  protected get db() {
    return getDatabaseManager().getPrimary();
  }

  protected get readDb() {
    return getDatabaseManager().getReplica();
  }

  protected async query(sql: string, params?: any[], options?: { useReplica?: boolean }): Promise<any> {
    const dbManager = getDatabaseManager();
    return dbManager.query(sql, params, options);
  }

  protected async transaction<T>(callback: (db: any) => Promise<T>): Promise<T> {
    const dbManager = getDatabaseManager();
    return dbManager.transaction(callback);
  }
}
```

## Routing

### Query Routing

```typescript
// lib/db/query-router.ts
import { getDatabaseManager } from './read-replicas';

export class QueryRouter {
  private dbManager = getDatabaseManager();

  // Write operations go to primary
  async write(sql: string, params?: any[]): Promise<any> {
    return this.dbManager.query(sql, params, { useReplica: false });
  }

  // Read operations go to replicas
  async read(sql: string, params?: any[]): Promise<any> {
    return this.dbManager.query(sql, params, { useReplica: true });
  }

  // Transactions go to primary
  async transaction<T>(callback: (db: any) => Promise<T>): Promise<T> {
    return this.dbManager.transaction(callback);
  }

  // Critical reads go to primary
  async criticalRead(sql: string, params?: any[]): Promise<any> {
    return this.dbManager.query(sql, params, { useReplica: false });
  }
}

export const queryRouter = new QueryRouter();
```

### Repository Pattern

```typescript
// lib/repositories/base-repository.ts
import { QueryRouter } from '../db/query-router';

export abstract class BaseRepository {
  protected queryRouter = new QueryRouter();

  // Write operations
  protected async insert(table: string, data: any): Promise<any> {
    const columns = Object.keys(data).join(', ');
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;

    return this.queryRouter.write(sql, values);
  }

  protected async update(table: string, id: string, data: any): Promise<any> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');

    const sql = `UPDATE ${table} SET ${setClause} WHERE id = $1 RETURNING *`;

    return this.queryRouter.write(sql, [id, ...values]);
  }

  protected async delete(table: string, id: string): Promise<any> {
    const sql = `DELETE FROM ${table} WHERE id = $1 RETURNING *`;

    return this.queryRouter.write(sql, [id]);
  }

  // Read operations
  protected async findById(table: string, id: string): Promise<any> {
    const sql = `SELECT * FROM ${table} WHERE id = $1`;

    return this.queryRouter.read(sql, [id]);
  }

  protected async findAll(table: string, options?: { limit?: number; offset?: number }): Promise<any> {
    let sql = `SELECT * FROM ${table}`;

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    return this.queryRouter.read(sql);
  }

  protected async findMany(table: string, conditions: any): Promise<any> {
    const columns = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = columns.map((col, i) => `${col} = $${i + 1}`).join(' AND ');

    const sql = `SELECT * FROM ${table} WHERE ${whereClause}`;

    return this.queryRouter.read(sql, values);
  }

  // Critical reads
  protected async findByIdCritical(table: string, id: string): Promise<any> {
    const sql = `SELECT * FROM ${table} WHERE id = $1`;

    return this.queryRouter.criticalRead(sql, [id]);
  }
}
```

## Best Practices

### 1. Route Reads to Replicas

Route reads to replicas:

```typescript
// Good: Route reads to replicas
const orders = await this.queryRouter.read('SELECT * FROM orders');

// Bad: Route reads to primary
const orders = await this.queryRouter.write('SELECT * FROM orders');
```

### 2. Route Writes to Primary

Route writes to primary:

```typescript
// Good: Route writes to primary
await this.queryRouter.write('INSERT INTO orders (...) VALUES (...)');

// Bad: Route writes to replicas
await this.queryRouter.read('INSERT INTO orders (...) VALUES (...)');
```

### 3. Use Transactions for Writes

Use transactions for writes:

```typescript
// Good: Use transactions for writes
await this.queryRouter.transaction(async (db) => {
  await db.execute('INSERT INTO orders (...) VALUES (...)');
  await db.execute('UPDATE inventory SET quantity = quantity - 1');
});

// Bad: No transactions
await this.queryRouter.write('INSERT INTO orders (...) VALUES (...)');
await this.queryRouter.write('UPDATE inventory SET quantity = quantity - 1');
```

### 4. Use Critical Reads for Important Data

Use critical reads for important data:

```typescript
// Good: Use critical reads for important data
const order = await this.queryRouter.criticalRead('SELECT * FROM orders WHERE id = $1', [orderId]);

// Bad: Use replicas for important data
const order = await this.queryRouter.read('SELECT * FROM orders WHERE id = $1', [orderId]);
```

### 5. Monitor Replication Lag

Monitor replication lag:

```typescript
// Good: Monitor replication lag
const lag = await this.getReplicationLag();
if (lag > 1000) { // 1 second
  console.warn('Replication lag is high');
}

// Bad: No monitoring
// No monitoring
```

### 6. Use Connection Pooling

Use connection pooling:

```typescript
// Good: Use connection pooling
const poolConfig: PoolConfig = {
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Bad: No connection pooling
const poolConfig: PoolConfig = {
  max: 1,
};
```

### 7. Document Read/Write Split

Document read/write split:

```markdown
# Good: Document read/write split
## Read/Write Split

- Write operations go to primary
- Read operations go to replicas
- Critical reads go to primary
- Transactions go to primary

# Bad: No documentation
# No documentation
```

## References

- [PostgreSQL Replication](https://www.postgresql.org/docs/current/high-availability.html)
- [AWS RDS Read Replicas](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html)
- [Connection Pooling](https://node-postgres.com/features/pooling)
- [Database Scaling](https://aws.amazon.com/blogs/database/scaling-postgresql-with-read-replicas/)

# Database Migration Rollback Scripts

This document describes the implementation of database migration rollback scripts for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Migration Structure](#migration-structure)
4. [Rollback Scripts](#rollback-scripts)
5. [Rollback Process](#rollback-process)
6. [Best Practices](#best-practices)

## Overview

Database migration rollback scripts are critical for reverting database changes when issues occur:

- **Automatic Rollback:** Rollback migrations automatically on failure
- **Manual Rollback:** Rollback migrations manually when needed
- **Version Control:** Track migration versions and rollbacks
- **Safety:** Ensure data integrity during rollbacks

## Features

### Migration Structure

```typescript
// lib/db/migrations.ts
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface Migration {
  id: string;
  name: string;
  version: number;
  up: (db: any) => Promise<void>;
  down: (db: any) => Promise<void>;
  appliedAt?: Date;
}

export class MigrationManager {
  private migrations: Migration[] = [];
  private appliedMigrations: Set<string> = new Set();

  constructor() {
    this.loadMigrations();
  }

  private loadMigrations(): void {
    // Load all migrations from migrations directory
    this.migrations = [
      {
        id: '001_create_users',
        name: 'Create users table',
        version: 1,
        up: async (db: any) => {
          await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              email VARCHAR(255) UNIQUE NOT NULL,
              password_hash VARCHAR(255) NOT NULL,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );
          `);
        },
        down: async (db: any) => {
          await db.execute(`DROP TABLE IF EXISTS users CASCADE;`);
        },
      },
      {
        id: '002_create_venues',
        name: 'Create venues table',
        version: 2,
        up: async (db: any) => {
          await db.execute(`
            CREATE TABLE IF NOT EXISTS venues (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              name VARCHAR(255) NOT NULL,
              address TEXT,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );
          `);
        },
        down: async (db: any) => {
          await db.execute(`DROP TABLE IF EXISTS venues CASCADE;`);
        },
      },
      {
        id: '003_create_orders',
        name: 'Create orders table',
        version: 3,
        up: async (db: any) => {
          await db.execute(`
            CREATE TABLE IF NOT EXISTS orders (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
              status VARCHAR(50) NOT NULL,
              total DECIMAL(10, 2) NOT NULL,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );
          `);
        },
        down: async (db: any) => {
          await db.execute(`DROP TABLE IF EXISTS orders CASCADE;`);
        },
      },
      // Add more migrations...
    ];
  }

  async getAppliedMigrations(): Promise<void> {
    // Create migrations table if it doesn't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        version INTEGER NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Load applied migrations
    const result = await db.execute(`SELECT id FROM schema_migrations;`);
    this.appliedMigrations = new Set(result.rows.map((row: any) => row.id));
  }

  async migrate(): Promise<void> {
    await this.getAppliedMigrations();

    for (const migration of this.migrations) {
      if (this.appliedMigrations.has(migration.id)) {
        console.log(`Migration ${migration.id} already applied`);
        continue;
      }

      console.log(`Applying migration ${migration.id}...`);

      try {
        await migration.up(db);

        await db.execute(`
          INSERT INTO schema_migrations (id, name, version)
          VALUES ('${migration.id}', '${migration.name}', ${migration.version});
        `);

        console.log(`Migration ${migration.id} applied successfully`);
      } catch (error) {
        console.error(`Migration ${migration.id} failed:`, error);

        // Rollback on failure
        await this.rollbackTo(migration.version - 1);

        throw error;
      }
    }
  }

  async rollback(version?: number): Promise<void> {
    await this.getAppliedMigrations();

    const migrationsToRollback = this.migrations
      .filter(m => this.appliedMigrations.has(m.id))
      .filter(m => version === undefined || m.version > version)
      .sort((a, b) => b.version - a.version);

    for (const migration of migrationsToRollback) {
      console.log(`Rolling back migration ${migration.id}...`);

      try {
        await migration.down(db);

        await db.execute(`DELETE FROM schema_migrations WHERE id = '${migration.id}';`);

        console.log(`Migration ${migration.id} rolled back successfully`);
      } catch (error) {
        console.error(`Rollback of migration ${migration.id} failed:`, error);
        throw error;
      }
    }
  }

  async rollbackTo(version: number): Promise<void> {
    await this.rollback(version);
  }

  async rollbackLast(): Promise<void> {
    await this.getAppliedMigrations();

    const lastMigration = this.migrations
      .filter(m => this.appliedMigrations.has(m.id))
      .sort((a, b) => b.version - a.version)[0];

    if (lastMigration) {
      await this.rollback(lastMigration.version - 1);
    }
  }

  async status(): Promise<void> {
    await this.getAppliedMigrations();

    console.log('Migration Status:');
    console.log('==================');

    for (const migration of this.migrations) {
      const applied = this.appliedMigrations.has(migration.id);
      console.log(`${applied ? '✓' : '✗'} ${migration.id} - ${migration.name}`);
    }
  }
}
```

### Rollback Scripts

```typescript
// scripts/rollback.ts
import { MigrationManager } from '../lib/db/migrations';

const migrationManager = new MigrationManager();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'migrate':
      await migrationManager.migrate();
      break;
    case 'rollback':
      const version = args[1] ? parseInt(args[1]) : undefined;
      await migrationManager.rollback(version);
      break;
    case 'rollback-last':
      await migrationManager.rollbackLast();
      break;
    case 'status':
      await migrationManager.status();
      break;
    default:
      console.log('Usage: npm run db:migrate [migrate|rollback|rollback-last|status] [version]');
      process.exit(1);
  }
}

main().catch(console.error);
```

## Rollback Process

### Example Migration with Rollback

```typescript
// migrations/004_add_order_status_index.ts
export const migration: Migration = {
  id: '004_add_order_status_index',
  name: 'Add order status index',
  version: 4,
  up: async (db: any) => {
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    `);
  },
  down: async (db: any) => {
    await db.execute(`DROP INDEX IF EXISTS idx_orders_status;`);
  },
};
```

### Complex Migration with Rollback

```typescript
// migrations/005_add_order_items_table.ts
export const migration: Migration = {
  id: '005_add_order_items_table',
  name: 'Add order items table',
  version: 5,
  up: async (db: any) => {
    // Create order_items table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
    `);

    // Migrate existing order data
    await db.execute(`
      INSERT INTO order_items (order_id, menu_item_id, quantity, price)
      SELECT
        o.id as order_id,
        o.menu_item_id,
        o.quantity,
        o.price
      FROM orders o
      WHERE o.menu_item_id IS NOT NULL;
    `);

    // Remove old columns
    await db.execute(`
      ALTER TABLE orders DROP COLUMN IF EXISTS menu_item_id;
      ALTER TABLE orders DROP COLUMN IF EXISTS quantity;
      ALTER TABLE orders DROP COLUMN IF EXISTS price;
    `);
  },
  down: async (db: any) => {
    // Add back old columns
    await db.execute(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS menu_item_id UUID;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);
    `);

    // Migrate data back
    await db.execute(`
      UPDATE orders o
      SET
        menu_item_id = oi.menu_item_id,
        quantity = oi.quantity,
        price = oi.price
      FROM order_items oi
      WHERE o.id = oi.order_id;
    `);

    // Drop order_items table
    await db.execute(`DROP TABLE IF EXISTS order_items CASCADE;`);
  },
};
```

### Data Migration with Rollback

```typescript
// migrations/006_migrate_user_roles.ts
export const migration: Migration = {
  id: '006_migrate_user_roles',
  name: 'Migrate user roles',
  version: 6,
  up: async (db: any) => {
    // Create backup table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_roles_backup AS
      SELECT * FROM user_roles;
    `);

    // Update user roles
    await db.execute(`
      UPDATE user_roles
      SET role = 'admin'
      WHERE role = 'super_admin';
    `);

    await db.execute(`
      UPDATE user_roles
      SET role = 'staff'
      WHERE role = 'employee';
    `);
  },
  down: async (db: any) => {
    // Restore from backup
    await db.execute(`
      TRUNCATE TABLE user_roles;
    `);

    await db.execute(`
      INSERT INTO user_roles
      SELECT * FROM user_roles_backup;
    `);

    // Drop backup table
    await db.execute(`DROP TABLE IF EXISTS user_roles_backup;`);
  },
};
```

## Best Practices

### 1. Always Write Rollback Scripts

Always write rollback scripts for all migrations:

```typescript
// Good: Always write rollback scripts
export const migration: Migration = {
  id: '001_create_users',
  name: 'Create users table',
  version: 1,
  up: async (db: any) => {
    await db.execute(`CREATE TABLE users (...);`);
  },
  down: async (db: any) => {
    await db.execute(`DROP TABLE users CASCADE;`);
  },
};

// Bad: No rollback script
export const migration: Migration = {
  id: '001_create_users',
  name: 'Create users table',
  version: 1,
  up: async (db: any) => {
    await db.execute(`CREATE TABLE users (...);`);
  },
  down: async (db: any) => {
    // No rollback script
  },
};
```

### 2. Test Rollback Scripts

Test rollback scripts before deploying:

```bash
# Good: Test rollback scripts
# Test migration and rollback in staging
npm run db:migrate
npm run db:rollback

# Bad: No testing
# No testing
```

### 3. Use Transactions

Use transactions for complex migrations:

```typescript
// Good: Use transactions
up: async (db: any) => {
  await db.transaction(async (tx) => {
    await tx.execute(`CREATE TABLE users (...);`);
    await tx.execute(`CREATE INDEX idx_users_email ON users(email);`);
  });
},

// Bad: No transactions
up: async (db: any) => {
  await db.execute(`CREATE TABLE users (...);`);
  await db.execute(`CREATE INDEX idx_users_email ON users(email);`);
},
```

### 4. Backup Data

Backup data before destructive migrations:

```typescript
// Good: Backup data
up: async (db: any) => {
  // Create backup
  await db.execute(`CREATE TABLE users_backup AS SELECT * FROM users;`);

  // Perform migration
  await db.execute(`ALTER TABLE users DROP COLUMN old_column;`);
},

down: async (db: any) => {
  // Restore from backup
  await db.execute(`ALTER TABLE users ADD COLUMN old_column VARCHAR(255);`);
  await db.execute(`UPDATE users SET old_column = (SELECT old_column FROM users_backup WHERE users.id = users_backup.id);`);

  // Drop backup
  await db.execute(`DROP TABLE users_backup;`);
},

// Bad: No backup
up: async (db: any) => {
  await db.execute(`ALTER TABLE users DROP COLUMN old_column;`);
},

down: async (db: any) => {
  // No way to restore data
},
```

### 5. Use Idempotent Migrations

Use idempotent migrations:

```typescript
// Good: Idempotent migration
up: async (db: any) => {
  await db.execute(`CREATE TABLE IF NOT EXISTS users (...);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
},

// Bad: Not idempotent
up: async (db: any) => {
  await db.execute(`CREATE TABLE users (...);`);
  await db.execute(`CREATE INDEX idx_users_email ON users(email);`);
},
```

### 6. Document Migrations

Document migrations with comments:

```typescript
// Good: Document migrations
export const migration: Migration = {
  id: '001_create_users',
  name: 'Create users table',
  version: 1,
  up: async (db: any) => {
    // Create users table with email and password
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
  },
  down: async (db: any) => {
    // Drop users table
    await db.execute(`DROP TABLE IF EXISTS users CASCADE;`);
  },
};

// Bad: No documentation
export const migration: Migration = {
  id: '001_create_users',
  name: 'Create users table',
  version: 1,
  up: async (db: any) => {
    await db.execute(`CREATE TABLE IF NOT EXISTS users (...);`);
  },
  down: async (db: any) => {
    await db.execute(`DROP TABLE IF EXISTS users CASCADE;`);
  },
};
```

### 7. Use Version Numbers

Use version numbers for migrations:

```typescript
// Good: Use version numbers
export const migration: Migration = {
  id: '001_create_users',
  name: 'Create users table',
  version: 1,
  up: async (db: any) => {
    await db.execute(`CREATE TABLE users (...);`);
  },
  down: async (db: any) => {
    await db.execute(`DROP TABLE users CASCADE;`);
  },
};

// Bad: No version numbers
export const migration: Migration = {
  id: 'create_users',
  name: 'Create users table',
  version: 0,
  up: async (db: any) => {
    await db.execute(`CREATE TABLE users (...);`);
  },
  down: async (db: any) => {
    await db.execute(`DROP TABLE users CASCADE;`);
  },
};
```

## References

- [Database Migrations](https://martinfowler.com/bliki/DatabaseMigration)
- [Drizzle ORM](https://orm.drizzle.team/)
- [PostgreSQL](https://www.postgresql.org/docs/)
- [Supabase](https://supabase.com/docs)

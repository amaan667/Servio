/**
 * @fileoverview Database Migration System (Working Version)
 * Provides a structured way to manage database migrations using Supabase SQL builder
 */

import { createSupabaseClient } from "@/lib/supabase";
import { logger } from "@/lib/monitoring/structured-logger";

export interface Migration {
  id: string;
  name: string;
  up: string; // SQL to apply migration
  down?: string; // SQL to rollback migration
  appliedAt?: Date;
}

export interface MigrationResult {
  success: boolean;
  migrationId: string;
  error?: string;
}

/**
 * Migration Manager
 * Handles database migrations with tracking and rollback support
 */
export class MigrationManager {
  /**
   * Get Supabase client (awaited)
   */
  private async getClient() {
    return await createSupabaseClient();
  }

  /**
   * Initialize migrations table
   */
  async initialize(): Promise<void> {
    const supabase = await this.getClient();

    const { error } = await supabase.from("schema_migrations").select("*").single();

    if (error) {
      logger.error("Failed to initialize migrations table", { error });
      throw error;
    }

    // Table doesn't exist, create it
    if (!error && !error) {
      const { error: createError } = await supabase.from("schema_migrations").insert({
        id: "schema_migrations",
        name: "text",
        columns: [
          { name: "id", type: "text", isNullable: false },
          { name: "name", type: "text", isNullable: false },
          { name: "applied_at", type: "timestamptz", isNullable: false },
        ],
      });

      if (createError) {
        logger.error("Failed to create migrations table", { error: createError });
        throw createError;
      }
    }
  }

  /**
   * Get all applied migrations
   */
  async getAppliedMigrations(): Promise<Migration[]> {
    const supabase = await this.getClient();

    const { data, error } = await supabase
      .from("schema_migrations")
      .select("*")
      .order("applied_at", { ascending: true });

    if (error) {
      logger.error("Failed to get applied migrations", { error });
      throw error;
    }

    return (data || []) as Migration[];
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(allMigrations: Migration[]): Promise<Migration[]> {
    const applied = await this.getAppliedMigrations();
    const appliedIds = new Set(applied.map((m) => m.id));

    return allMigrations.filter((m) => !appliedIds.has(m.id));
  }

  /**
   * Apply a single migration
   */
  async applyMigration(migration: Migration): Promise<MigrationResult> {
    try {
      logger.info(`Applying migration: ${migration.name}`, { migrationId: migration.id });

      const supabase = await this.getClient();

      // Execute migration SQL using Supabase SQL builder
      const { error: sqlError } = await supabase.rpc("exec_sql", {
        sql: migration.up,
      });

      if (sqlError) {
        throw sqlError;
      }

      // Record migration as applied
      const { error: recordError } = await supabase.from("schema_migrations").insert({
        id: migration.id,
        name: migration.name,
        applied_at: new Date().toISOString(),
      });

      if (recordError) {
        throw recordError;
      }

      logger.info(`Migration applied successfully: ${migration.name}`, {
        migrationId: migration.id,
      });

      return { success: true, migrationId: migration.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Migration failed: ${migration.name}`, {
        migrationId: migration.id,
        error: errorMessage,
      });

      return {
        success: false,
        migrationId: migration.id,
        error: errorMessage,
      };
    }
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(migration: Migration): Promise<MigrationResult> {
    if (!migration.down) {
      return {
        success: false,
        migrationId: migration.id,
        error: "No rollback SQL defined for this migration",
      };
    }

    try {
      logger.info(`Rolling back migration: ${migration.name}`, {
        migrationId: migration.id,
      });

      const supabase = await this.getClient();

      // Execute rollback SQL
      const { error: sqlError } = await supabase.rpc("exec_sql", {
        sql: migration.down,
      });

      if (sqlError) {
        throw sqlError;
      }

      // Remove migration record
      const { error: deleteError } = await supabase
        .from("schema_migrations")
        .delete()
        .eq("id", migration.id);

      if (deleteError) {
        throw deleteError;
      }

      logger.info(`Migration rolled back successfully: ${migration.name}`, {
        migrationId: migration.id,
      });

      return { success: true, migrationId: migration.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Migration rollback failed: ${migration.name}`, {
        migrationId: migration.id,
        error: errorMessage,
      });

      return {
        success: false,
        migrationId: migration.id,
        error: errorMessage,
      };
    }
  }

  /**
   * Apply all pending migrations
   */
  async migrate(allMigrations: Migration[]): Promise<MigrationResult[]> {
    await this.initialize();

    const pending = await this.getPendingMigrations(allMigrations);

    if (pending.length === 0) {
      logger.info("No pending migrations to apply");
      return [];
    }

    logger.info(`Applying ${pending.length} pending migrations`);

    const results: MigrationResult[] = [];

    for (const migration of pending) {
      const result = await this.applyMigration(migration);
      results.push(result);

      if (!result.success) {
        logger.error(`Migration failed, stopping`, { migrationId: migration.id });
        break; // Stop on first failure
      }
    }

    return results;
  }

  /**
   * Rollback last N migrations
   */
  async rollback(count: number = 1): Promise<MigrationResult[]> {
    const applied = await this.getAppliedMigrations();
    const toRollback = applied.slice(-count);

    if (toRollback.length === 0) {
      logger.info("No migrations to rollback");
      return [];
    }

    logger.info(`Rolling back ${toRollback.length} migrations`);

    const results: MigrationResult[] = [];

    // Rollback in reverse order
    for (let i = toRollback.length - 1; i >= 0; i--) {
      const migration = toRollback[i];
      if (!migration) {
        logger.error(`Migration at index ${i} is undefined, skipping`);
        continue;
      }
      const result = await this.rollbackMigration(migration);
      results.push(result);

      if (!result.success) {
        logger.error(`Rollback failed, stopping`, { migrationId: migration.id });
        break;
      }
    }

    return results;
  }

  /**
   * Get migration status
   */
  async getStatus(allMigrations: Migration[]): Promise<{
    applied: Migration[];
    pending: Migration[];
  }> {
    await this.initialize();

    const applied = await this.getAppliedMigrations();
    const appliedIds = new Set(applied.map((m) => m.id));
    const pending = allMigrations.filter((m) => !appliedIds.has(m.id));

    return { applied, pending };
  }
}

// Export singleton instance
export const migrationManager = new MigrationManager();

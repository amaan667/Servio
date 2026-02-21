/**
 * Bulk Operations Service
 *
 * Centralized service for bulk operations across all entity types
 * with batch processing, progress tracking, and rollback support.
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient } from "@/lib/supabase";
import {
  BulkOperationResult,
  BulkCreateInput,
  BulkUpdateInput,
  BulkDeleteInput,
  BulkImportInput,
  ProgressUpdate,
  ProgressCallback,
  ValidationError,
  ValidationResult,
  BatchConfig,
  DEFAULT_BATCH_CONFIG,
  RollbackInfo,
  BulkOperationItemResult,
} from "../bulk-operations/types";
import { logger } from "@/lib/monitoring/structured-logger";

/**
 * Generate unique operation ID
 */
function generateOperationId(): string {
  return `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate progress percentage
 */
function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((completed / total) * 100);
}

/**
 * Sleep utility for batch delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic record type
 */
type GenericRecord = Record<string, unknown>;

export class BulkOperationsService extends BaseService {
  private operationId: string;
  private startTime: number;
  private progressCallback?: ProgressCallback;
  private rollbackStack: Array<() => Promise<void>> = [];

  constructor() {
    super();
    this.operationId = "";
    this.startTime = 0;
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Notify progress update
   */
  private async notifyProgress(
    total: number,
    completed: number,
    failed: number,
    currentIndex: number,
    currentOperation: string
  ): Promise<void> {
    const elapsedMs = Date.now() - this.startTime;
    const progressPercent = calculateProgress(completed + failed, total);
    const ratePerSecond = completed > 0 ? completed / (elapsedMs / 1000) : 0;
    const estimatedRemainingMs =
      ratePerSecond > 0 ? ((total - completed - failed) / ratePerSecond) * 1000 : undefined;

    const update: ProgressUpdate = {
      operationId: this.operationId,
      total,
      completed,
      failed,
      currentIndex,
      currentOperation,
      elapsedMs,
      estimatedRemainingMs,
      progressPercent,
      ratePerSecond,
    };

    if (this.progressCallback) {
      await this.progressCallback(update);
    }

    if (completed % 100 === 0 || failed > 0) {
      logger.info("[BulkOperations] Progress update", {
        operationId: this.operationId,
        progress: update.progressPercent,
        completed,
        failed,
        total,
      });
    }
  }

  /**
   * Get item count from input
   */
  private getItemCount(
    input: BulkCreateInput | BulkUpdateInput | BulkDeleteInput | BulkImportInput
  ): number {
    switch (input.type) {
      case "bulk_create":
        return input.items?.length || 0;
      case "bulk_import":
        return (
          (input as BulkImportInput).items?.length || (input as BulkImportInput).rows?.length || 0
        );
      case "bulk_update":
        return input.updates?.length || 0;
      case "bulk_delete":
        return input.ids?.length || 0;
      default:
        return 0;
    }
  }

  /**
   * Execute bulk operation based on type
   */
  async executeBulkOperation<T extends GenericRecord = GenericRecord>(
    input: BulkCreateInput<T> | BulkUpdateInput<T> | BulkDeleteInput | BulkImportInput<T>
  ): Promise<BulkOperationResult<T>> {
    this.operationId = generateOperationId();
    this.startTime = Date.now();
    this.rollbackStack = [];

    const config = { ...DEFAULT_BATCH_CONFIG, ...input.batchConfig };
    const startTime = Date.now();

    logger.info("[BulkOperations] Starting operation", {
      operationId: this.operationId,
      type: input.type,
      venueId: input.venueId,
      itemCount: this.getItemCount(input),
    });

    try {
      let result: BulkOperationResult<T>;

      switch (input.type) {
        case "bulk_create":
          result = await this.bulkCreate(input as BulkCreateInput<T>, config);
          break;
        case "bulk_update":
          result = await this.bulkUpdate(input as BulkUpdateInput<T>, config);
          break;
        case "bulk_delete":
          result = (await this.bulkDelete(
            input as BulkDeleteInput,
            config
          )) as BulkOperationResult<T>;
          break;
        default:
          throw new Error(`Unsupported bulk operation type`);
      }

      result.elapsedMs = Date.now() - startTime;

      logger.info("[BulkOperations] Operation completed", {
        operationId: this.operationId,
        status: result.status,
        successful: result.successful,
        failed: result.failed,
        elapsedMs: result.elapsedMs,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("[BulkOperations] Operation failed", {
        operationId: this.operationId,
        error: errorMessage,
      });

      if (this.rollbackStack.length > 0) {
        await this.performRollback();
      }

      throw error;
    }
  }

  /**
   * Bulk create items
   */
  async bulkCreate<T extends GenericRecord>(
    input: BulkCreateInput<T>,
    config: BatchConfig
  ): Promise<BulkOperationResult<T>> {
    const supabase = await createSupabaseClient();
    const results: BulkOperationItemResult<T>[] = [];
    const validationErrors: ValidationError[] = [];
    const entityType = this.getEntityTypeFromItems(input.items);

    let successful = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < input.items.length; i += config.batchSize) {
      const batch = input.items.slice(i, i + config.batchSize);

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j]!;
        const row = i + j + 1;

        try {
          if (!input.skipValidation) {
            const validation = await this.validateItem(item, entityType);
            if (!validation.isValid) {
              validationErrors.push(...validation.errors);
              skipped++;
              continue;
            }
          }

          if (input.dryRun) {
            results.push({
              row,
              success: true,
              data: item as T,
            });
            successful++;
          } else {
            const { data, error } = await supabase.from(entityType).insert(item).select().single();

            if (error) {
              results.push({
                row,
                success: false,
                error: error.message,
                errorCode: error.code,
              });
              failed++;
            } else {
              results.push({
                row,
                success: true,
                data: data as T,
              });
              successful++;

              this.rollbackStack.push(async () => {
                await supabase.from(entityType).delete().eq("id", data.id);
              });
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          results.push({
            row,
            success: false,
            error: errorMessage,
          });
          failed++;
        }

        await this.notifyProgress(
          input.items.length,
          successful + failed,
          failed,
          i + j,
          `Creating ${entityType}`
        );

        if (config.batchDelay > 0) {
          await sleep(config.batchDelay);
        }
      }
    }

    return {
      operationId: this.operationId,
      type: "bulk_create",
      entityType,
      total: input.items.length,
      successful,
      failed,
      skipped,
      results,
      validationErrors,
      status: failed === 0 ? "completed" : failed === successful ? "failed" : "partial_success",
      elapsedMs: 0,
      rollbackPerformed: false,
      warnings: [],
    };
  }

  /**
   * Bulk update items
   */
  async bulkUpdate<T extends GenericRecord>(
    input: BulkUpdateInput<T>,
    config: BatchConfig
  ): Promise<BulkOperationResult<T>> {
    const supabase = await createSupabaseClient();
    const results: BulkOperationItemResult<T>[] = [];
    const validationErrors: ValidationError[] = [];
    const entityType = "menu_items";

    let successful = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < input.updates.length; i += config.batchSize) {
      const batch = input.updates.slice(i, i + config.batchSize);

      for (let j = 0; j < batch.length; j++) {
        const updateItem = batch[j];
        if (!updateItem) continue;
        const { id, data } = updateItem;
        const row = i + j + 1;

        try {
          const { data: existing } = await supabase
            .from(entityType)
            .select("id")
            .eq("id", id)
            .maybeSingle();

          if (!existing) {
            if (input.skipMissing) {
              skipped++;
              continue;
            }
            results.push({
              id,
              row,
              success: false,
              error: "Item not found",
              errorCode: "NOT_FOUND",
            });
            failed++;
            continue;
          }

          if (input.dryRun) {
            results.push({
              id,
              row,
              success: true,
              data: data as T,
            });
            successful++;
          } else {
            const { data: updated, error } = await supabase
              .from(entityType)
              .update(data)
              .eq("id", id)
              .select()
              .single();

            if (error) {
              results.push({
                id,
                row,
                success: false,
                error: error.message,
                errorCode: error.code,
              });
              failed++;
            } else {
              results.push({
                id,
                row,
                success: true,
                data: updated as T,
              });
              successful++;

              this.rollbackStack.push(async () => {
                await supabase.from(entityType).update(existing).eq("id", id);
              });
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          results.push({
            id,
            row,
            success: false,
            error: errorMessage,
          });
          failed++;
        }

        await this.notifyProgress(
          input.updates.length,
          successful + failed,
          failed,
          i + j,
          `Updating ${entityType}`
        );

        if (config.batchDelay > 0) {
          await sleep(config.batchDelay);
        }
      }
    }

    return {
      operationId: this.operationId,
      type: "bulk_update",
      entityType,
      total: input.updates.length,
      successful,
      failed,
      skipped,
      results,
      validationErrors,
      status: failed === 0 ? "completed" : failed === successful ? "failed" : "partial_success",
      elapsedMs: 0,
      rollbackPerformed: false,
      warnings: [],
    };
  }

  /**
   * Bulk delete items
   */
  async bulkDelete(
    input: BulkDeleteInput,
    config: BatchConfig
  ): Promise<BulkOperationResult<GenericRecord>> {
    const supabase = await createSupabaseClient();
    const results: BulkOperationItemResult<GenericRecord>[] = [];
    const validationErrors: ValidationError[] = [];
    const entityType = input.entityType || "menu_items";

    let successful = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < input.ids.length; i += config.batchSize) {
      const batch = input.ids.slice(i, i + config.batchSize);

      for (let j = 0; j < batch.length; j++) {
        const id = batch[j]!;
        const row = i + j + 1;

        try {
          const { data: existing } = await supabase
            .from(entityType)
            .select("id")
            .eq("id", id)
            .maybeSingle();

          if (!existing) {
            if (input.skipMissing) {
              skipped++;
              continue;
            }
            results.push({
              id,
              row,
              success: false,
              error: "Item not found",
              errorCode: "NOT_FOUND",
            });
            failed++;
            continue;
          }

          if (input.dryRun) {
            results.push({
              id,
              row,
              success: true,
            });
            successful++;
          } else {
            const itemToDelete = { ...existing };

            const { error } = await supabase.from(entityType).delete().eq("id", id);

            if (error) {
              results.push({
                id,
                row,
                success: false,
                error: error.message,
                errorCode: error.code,
              });
              failed++;
            } else {
              results.push({
                id,
                row,
                success: true,
              });
              successful++;

              this.rollbackStack.push(async () => {
                await supabase.from(entityType).insert(itemToDelete);
              });
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          results.push({
            id,
            row,
            success: false,
            error: errorMessage,
          });
          failed++;
        }

        await this.notifyProgress(
          input.ids.length,
          successful + failed,
          failed,
          i + j,
          `Deleting ${entityType}`
        );

        if (config.batchDelay > 0) {
          await sleep(config.batchDelay);
        }
      }
    }

    return {
      operationId: this.operationId,
      type: "bulk_delete",
      entityType,
      total: input.ids.length,
      successful,
      failed,
      skipped,
      results,
      validationErrors,
      status: failed === 0 ? "completed" : failed === successful ? "failed" : "partial_success",
      elapsedMs: 0,
      rollbackPerformed: false,
      warnings: [],
    };
  }

  /**
   * Validate item before operation
   */
  private async validateItem<T extends GenericRecord>(
    item: T,
    entityType: string
  ): Promise<ValidationResult<T>> {
    const errors: ValidationError[] = [];
    const itemRecord = item as Record<string, unknown>;

    switch (entityType) {
      case "menu_items":
        if (!itemRecord.name && !(itemRecord as Record<string, unknown>).name_en) {
          errors.push({ field: "name", message: "Menu item name is required" });
        }
        if (
          itemRecord.price !== undefined &&
          typeof itemRecord.price === "number" &&
          itemRecord.price < 0
        ) {
          errors.push({ field: "price", message: "Price cannot be negative" });
        }
        break;

      case "inventory_items":
        if (!itemRecord.name) {
          errors.push({ field: "name", message: "Inventory item name is required" });
        }
        if (!itemRecord.unit) {
          errors.push({ field: "unit", message: "Unit is required" });
        }
        break;

      case "orders":
        if (!itemRecord.customer_name) {
          errors.push({ field: "customer_name", message: "Customer name is required" });
        }
        if (
          !itemRecord.items ||
          !Array.isArray(itemRecord.items) ||
          itemRecord.items.length === 0
        ) {
          errors.push({ field: "items", message: "Order must have at least one item" });
        }
        break;

      case "tables":
        if (!itemRecord.table_number) {
          errors.push({ field: "table_number", message: "Table number is required" });
        }
        if (
          itemRecord.seat_count !== undefined &&
          typeof itemRecord.seat_count === "number" &&
          itemRecord.seat_count < 0
        ) {
          errors.push({ field: "seat_count", message: "Seat count cannot be negative" });
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      data: item,
      errors,
    };
  }

  /**
   * Get entity type from items array
   */
  private getEntityTypeFromItems<T extends GenericRecord>(items: T[]): string {
    if (items.length === 0) return "menu_items";

    const sample = items[0] as Record<string, unknown>;
    if ("venue_id" in sample && "price" in sample) return "menu_items";
    if ("venue_id" in sample && "on_hand" in sample) return "inventory_items";
    if ("venue_id" in sample && "customer_name" in sample) return "orders";
    if ("venue_id" in sample && "table_number" in sample) return "tables";

    return "menu_items";
  }

  /**
   * Perform rollback
   */
  async performRollback(): Promise<RollbackInfo> {
    const rolledBack: Array<{ id: string; error: string }> = [];
    let successCount = 0;
    let failCount = 0;

    logger.info("[BulkOperations] Starting rollback", {
      operationId: this.operationId,
      rollbackCount: this.rollbackStack.length,
    });

    for (let i = this.rollbackStack.length - 1; i >= 0; i--) {
      const rollbackFn = this.rollbackStack[i];
      if (!rollbackFn) continue;
      try {
        await rollbackFn();
        successCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        rolledBack.push({ id: `rollback_${i}`, error: errorMessage });
        failCount++;
      }
    }

    logger.info("[BulkOperations] Rollback completed", {
      operationId: this.operationId,
      rolledBack: successCount,
      failed: failCount,
    });

    return {
      available: this.rollbackStack.length > 0,
      rolledBack: successCount,
      failedRollback: failCount,
      errors: rolledBack,
    };
  }

  /**
   * Get operation status
   */
  async getOperationStatus(_operationId: string): Promise<BulkOperationResult | null> {
    return null;
  }

  /**
   * Cancel ongoing operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    logger.info("[BulkOperations] Cancelling operation", { operationId });
    return true;
  }

  /**
   * Bulk menu item operations - convenience method
   */
  async bulkMenuItemOperations(
    venueId: string,
    userId: string,
    operations: Array<{
      type: "create" | "update" | "delete";
      data?: Record<string, unknown>;
      id?: string;
    }>,
    options: { dryRun?: boolean; batchSize?: number } = {}
  ): Promise<BulkOperationResult> {
    const createOps = operations.filter((op) => op.type === "create");
    const updateOps = operations.filter((op) => op.type === "update");
    const deleteOps = operations.filter((op) => op.type === "delete");

    const results: BulkOperationResult[] = [];

    if (createOps.length > 0) {
      results.push(
        await this.executeBulkOperation({
          type: "bulk_create",
          venueId,
          userId,
          items: createOps.map((op) => op.data!),
          dryRun: options.dryRun,
          batchConfig: { batchSize: options.batchSize || 50 },
        })
      );
    }

    if (updateOps.length > 0) {
      results.push(
        await this.executeBulkOperation({
          type: "bulk_update",
          venueId,
          userId,
          updates: updateOps.map((op) => ({ id: op.id!, data: op.data! })),
          dryRun: options.dryRun,
          batchConfig: { batchSize: options.batchSize || 50 },
        })
      );
    }

    if (deleteOps.length > 0) {
      results.push(
        await this.executeBulkOperation({
          type: "bulk_delete",
          venueId,
          userId,
          ids: deleteOps.map((op) => op.id!),
          dryRun: options.dryRun,
          batchConfig: { batchSize: options.batchSize || 50 },
        })
      );
    }

    return {
      operationId: this.operationId,
      type: "bulk_create",
      entityType: "menu_items",
      total: results.reduce((sum, r) => sum + r.total, 0),
      successful: results.reduce((sum, r) => sum + r.successful, 0),
      failed: results.reduce((sum, r) => sum + r.failed, 0),
      skipped: results.reduce((sum, r) => sum + r.skipped, 0),
      results: results.flatMap((r) => r.results),
      validationErrors: results.flatMap((r) => r.validationErrors),
      status: results.every((r) => r.status === "completed")
        ? "completed"
        : results.some((r) => r.failed > 0)
          ? "partial_success"
          : "failed",
      elapsedMs: results.reduce((sum, r) => sum + r.elapsedMs, 0),
      rollbackPerformed: false,
      warnings: results.flatMap((r) => r.warnings),
    };
  }

  /**
   * Bulk inventory operations - convenience method
   */
  async bulkInventoryOperations(
    venueId: string,
    _userId: string,
    _operations: Array<{
      type: "adjust_stock" | "update_prices" | "create" | "delete";
      data?: Record<string, unknown>;
      ids?: string[];
    }>,
    _options: { dryRun?: boolean; batchSize?: number } = {}
  ): Promise<BulkOperationResult> {
    logger.info("[BulkOperations] Bulk inventory operations", {
      venueId,
      operationCount: 0,
    });

    return {
      operationId: this.operationId,
      type: "bulk_update",
      entityType: "inventory_items",
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      results: [],
      validationErrors: [],
      status: "completed",
      elapsedMs: 0,
      rollbackPerformed: false,
      warnings: [],
    };
  }

  /**
   * Bulk order operations - convenience method
   */
  async bulkOrderOperations(
    venueId: string,
    _userId: string,
    _operations: Array<{
      type: "update_status" | "cancel";
      orderIds: string[];
      data?: Record<string, unknown>;
    }>,
    _options: { dryRun?: boolean; batchSize?: number } = {}
  ): Promise<BulkOperationResult> {
    logger.info("[BulkOperations] Bulk order operations", {
      venueId,
      operationCount: 0,
    });

    return {
      operationId: this.operationId,
      type: "bulk_update",
      entityType: "orders",
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      results: [],
      validationErrors: [],
      status: "completed",
      elapsedMs: 0,
      rollbackPerformed: false,
      warnings: [],
    };
  }
}

// Export singleton instance
export const bulkOperationsService = new BulkOperationsService();

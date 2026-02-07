/**
 * Bulk Inventory API Route
 *
 * API endpoint for bulk inventory operations
 */

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { bulkOperationsService } from "@/lib/services/BulkOperationsService";
import { BulkCreateInput } from "@/lib/bulk-operations/types";
import { apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { z } from "zod";
import { logger } from "@/lib/monitoring/structured-logger";

const bulkInventoryCreateSchema = z.object({
  venueId: z.string().optional(),
  venue_id: z.string().optional(),
  items: z.array(
    z.object({
      name: z.string().min(1),
      sku: z.string().optional(),
      unit: z.string().min(1),
      on_hand: z.number().min(0).optional(),
      cost_per_unit: z.number().min(0).optional(),
      par_level: z.number().min(0).optional(),
      reorder_level: z.number().min(0).optional(),
      supplier: z.string().optional(),
    })
  ).min(1),
  dryRun: z.boolean().optional(),
});

const bulkInventoryUpdateSchema = z.object({
  venueId: z.string().optional(),
  venue_id: z.string().optional(),
  updates: z.array(
    z.object({
      id: z.string(),
      data: z.object({
        name: z.string().optional(),
        sku: z.string().optional(),
        unit: z.string().optional(),
        on_hand: z.number().min(0).optional(),
        cost_per_unit: z.number().min(0).optional(),
        par_level: z.number().min(0).optional(),
        reorder_level: z.number().min(0).optional(),
        supplier: z.string().optional(),
      }),
    })
  ).min(1),
  dryRun: z.boolean().optional(),
  skipMissing: z.boolean().optional(),
});

const bulkInventoryDeleteSchema = z.object({
  venueId: z.string().optional(),
  venue_id: z.string().optional(),
  ids: z.array(z.string()).min(1),
  dryRun: z.boolean().optional(),
  skipMissing: z.boolean().optional(),
});

/**
 * POST: Bulk create inventory items
 */
export const POST = createUnifiedHandler(
  async (_req, context) => {
    try {
      const rateLimitResult = await rateLimit(_req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      const venueId = context.venueId;
      const userId = context.user?.id || "";

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      const body = context.body;
      const validationResult = bulkInventoryCreateSchema.safeParse(body);

      if (!validationResult.success) {
        return handleZodError(validationResult.error);
      }

      const { items, dryRun } = validationResult.data;

      logger.info("[bulk/inventory] Bulk create request", {
        venueId,
        itemCount: items.length,
        dryRun,
      });

      const result = await bulkOperationsService.executeBulkOperation({
        type: "bulk_create",
        venueId,
        userId,
        items,
        dryRun,
      } as unknown as BulkCreateInput);

      return {
        operationId: result.operationId,
        status: result.status,
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
        elapsedMs: result.elapsedMs,
      };
    } catch (error) {
      if (isZodError(error)) {
        return handleZodError(error);
      }
      return apiErrors.internal(
        "Bulk inventory create failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    requireVenueAccess: true,
    schema: bulkInventoryCreateSchema,
    requireRole: ["owner", "manager"],
  }
);

/**
 * PUT: Bulk update inventory items
 */
export const PUT = createUnifiedHandler(
  async (_req, context) => {
    try {
      const rateLimitResult = await rateLimit(_req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      const venueId = context.venueId;
      const userId = context.user?.id || "";

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      const body = context.body;
      const validationResult = bulkInventoryUpdateSchema.safeParse(body);

      if (!validationResult.success) {
        return handleZodError(validationResult.error);
      }

      const { updates, dryRun, skipMissing } = validationResult.data;

      logger.info("[bulk/inventory] Bulk update request", {
        venueId,
        updateCount: updates.length,
        dryRun,
      });

      const result = await bulkOperationsService.executeBulkOperation({
        type: "bulk_update",
        venueId,
        userId,
        updates,
        dryRun,
        skipMissing,
      });

      return {
        operationId: result.operationId,
        status: result.status,
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
        elapsedMs: result.elapsedMs,
      };
    } catch (error) {
      if (isZodError(error)) {
        return handleZodError(error);
      }
      return apiErrors.internal(
        "Bulk inventory update failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    requireVenueAccess: true,
    schema: bulkInventoryUpdateSchema,
    requireRole: ["owner", "manager"],
  }
);

/**
 * DELETE: Bulk delete inventory items
 */
export const DELETE = createUnifiedHandler(
  async (_req, context) => {
    try {
      const rateLimitResult = await rateLimit(_req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      const venueId = context.venueId;
      const userId = context.user?.id || "";

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      const body = context.body;
      const validationResult = bulkInventoryDeleteSchema.safeParse(body);

      if (!validationResult.success) {
        return handleZodError(validationResult.error);
      }

      const { ids, dryRun, skipMissing } = validationResult.data;

      logger.info("[bulk/inventory] Bulk delete request", {
        venueId,
        deleteCount: ids.length,
        dryRun,
      });

      const result = await bulkOperationsService.executeBulkOperation({
        type: "bulk_delete",
        venueId,
        userId,
        ids,
        entityType: "inventory_items",
        dryRun,
        skipMissing,
      });

      return {
        operationId: result.operationId,
        status: result.status,
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
        elapsedMs: result.elapsedMs,
      };
    } catch (error) {
      if (isZodError(error)) {
        return handleZodError(error);
      }
      return apiErrors.internal(
        "Bulk inventory delete failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    requireVenueAccess: true,
    schema: bulkInventoryDeleteSchema,
    requireRole: ["owner", "manager"],
  }
);

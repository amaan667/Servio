/**
 * Bulk Menu Items API Route
 *
 * API endpoint for bulk menu item operations
 */

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { bulkOperationsService } from "@/lib/services/BulkOperationsService";
import { apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { z } from "zod";
import { logger } from "@/lib/monitoring/structured-logger";

const bulkMenuCreateSchema = z.object({
  venueId: z.string().optional(),
  venue_id: z.string().optional(),
  items: z.array(
    z.object({
      name_en: z.string().optional(),
      name_ar: z.string().optional(),
      description_en: z.string().optional(),
      description_ar: z.string().optional(),
      price: z.number().min(0).optional(),
      category: z.string().optional(),
      is_available: z.boolean().optional(),
    })
  ).min(1),
  dryRun: z.boolean().optional(),
});

const bulkMenuUpdateSchema = z.object({
  venueId: z.string().optional(),
  venue_id: z.string().optional(),
  updates: z.array(
    z.object({
      id: z.string(),
      data: z.object({
        name_en: z.string().optional(),
        name_ar: z.string().optional(),
        description_en: z.string().optional(),
        description_ar: z.string().optional(),
        price: z.number().min(0).optional(),
        category: z.string().optional(),
        is_available: z.boolean().optional(),
      }),
    })
  ).min(1),
  dryRun: z.boolean().optional(),
  skipMissing: z.boolean().optional(),
});

const bulkMenuDeleteSchema = z.object({
  venueId: z.string().optional(),
  venue_id: z.string().optional(),
  ids: z.array(z.string()).min(1),
  dryRun: z.boolean().optional(),
  skipMissing: z.boolean().optional(),
});

/**
 * POST: Bulk create menu items
 */
export const POST = createUnifiedHandler(
  async (req, context) => {
    try {
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      const venueId = context.venueId;
      const userId = context.user?.id || "";

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      const body = context.body;
      const validationResult = bulkMenuCreateSchema.safeParse(body);
      if (!validationResult.success) {
        return handleZodError(validationResult.error);
      }

      const { items, dryRun } = validationResult.data;

      logger.info("[bulk/menu-items] Bulk create request", {
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
      });

      return {
        operationId: result.operationId,
        status: result.status,
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
        validationErrors: result.validationErrors,
        elapsedMs: result.elapsedMs,
        warnings: result.warnings,
      };
    } catch (error) {
      if (isZodError(error)) {
        return handleZodError(error);
      }
      return apiErrors.internal(
        "Bulk menu create failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    requireVenueAccess: true,
    schema: bulkMenuCreateSchema,
    requireRole: ["owner", "manager"],
  }
);

/**
 * PUT: Bulk update menu items
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
      const validationResult = bulkMenuUpdateSchema.safeParse(body);

      if (!validationResult.success) {
        return handleZodError(validationResult.error);
      }

      const { updates, dryRun, skipMissing } = validationResult.data;

      logger.info("[bulk/menu-items] Bulk update request", {
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
        validationErrors: result.validationErrors,
        elapsedMs: result.elapsedMs,
      };
    } catch (error) {
      if (isZodError(error)) {
        return handleZodError(error);
      }
      return apiErrors.internal(
        "Bulk menu update failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    requireVenueAccess: true,
    schema: bulkMenuUpdateSchema,
    requireRole: ["owner", "manager"],
  }
);

/**
 * DELETE: Bulk delete menu items
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
      const validationResult = bulkMenuDeleteSchema.safeParse(body);

      if (!validationResult.success) {
        return handleZodError(validationResult.error);
      }

      const { ids, dryRun, skipMissing } = validationResult.data;

      logger.info("[bulk/menu-items] Bulk delete request", {
        venueId,
        deleteCount: ids.length,
        dryRun,
      });

      const result = await bulkOperationsService.executeBulkOperation({
        type: "bulk_delete",
        venueId,
        userId,
        ids,
        entityType: "menu_items",
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
        "Bulk menu delete failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    requireVenueAccess: true,
    schema: bulkMenuDeleteSchema,
    requireRole: ["owner", "manager"],
  }
);

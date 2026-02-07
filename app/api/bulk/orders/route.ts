/**
 * Bulk Orders API Route
 *
 * API endpoint for bulk order operations
 */

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { bulkOperationsService } from "@/lib/services/BulkOperationsService";
import { apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { z } from "zod";
import { logger } from "@/lib/monitoring/structured-logger";

interface OrderUpdateData extends Record<string, unknown> {
  order_status?: string;
  cancellation_reason?: string;
  payment_status?: string;
  force_complete?: boolean;
}

const bulkOrderStatusUpdateSchema = z.object({
  venueId: z.string().optional(),
  venue_id: z.string().optional(),
  orderIds: z.array(z.string()).min(1),
  status: z.enum(["PLACED", "IN_PREP", "READY", "SERVED", "COMPLETED", "CANCELLED"]),
  dryRun: z.boolean().optional(),
});

const bulkOrderCancelSchema = z.object({
  venueId: z.string().optional(),
  venue_id: z.string().optional(),
  orderIds: z.array(z.string()).min(1),
  reason: z.string().optional(),
  dryRun: z.boolean().optional(),
});

const bulkOrderCompleteSchema = z.object({
  venueId: z.string().optional(),
  venue_id: z.string().optional(),
  orderIds: z.array(z.string()).min(1),
  force: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

/**
 * PUT: Bulk update order status
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
      const validationResult = bulkOrderStatusUpdateSchema.safeParse(body);

      if (!validationResult.success) {
        return handleZodError(validationResult.error);
      }

      const { orderIds, status, dryRun } = validationResult.data;

      logger.info("[bulk/orders] Bulk status update request", {
        venueId,
        orderCount: orderIds.length,
        newStatus: status,
        dryRun,
      });

      const result = await bulkOperationsService.bulkUpdate<
        OrderUpdateData
      >(
        { type: "bulk_update", venueId, userId, updates: orderIds.map((id) => ({ id, data: { order_status: status } })), dryRun },
        { batchSize: 50, batchDelay: 100, maxConcurrency: 5, retryEnabled: true, maxRetries: 3, retryDelay: 1000 }
      );

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
        "Bulk order status update failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    requireVenueAccess: true,
    schema: bulkOrderStatusUpdateSchema,
    requireRole: ["owner", "manager", "staff"],
  }
);

/**
 * POST: Bulk cancel orders
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
      const validationResult = bulkOrderCancelSchema.safeParse(body);

      if (!validationResult.success) {
        return handleZodError(validationResult.error);
      }

      const { orderIds, reason, dryRun } = validationResult.data;

      logger.info("[bulk/orders] Bulk cancel request", {
        venueId,
        orderCount: orderIds.length,
        reason,
        dryRun,
      });

      const result = await bulkOperationsService.bulkUpdate<
        OrderUpdateData
      >(
        { type: "bulk_update", venueId, userId, updates: orderIds.map((id) => ({ id, data: { order_status: "CANCELLED", cancellation_reason: reason } })), dryRun },
        { batchSize: 50, batchDelay: 100, maxConcurrency: 5, retryEnabled: true, maxRetries: 3, retryDelay: 1000 }
      );

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
        "Bulk order cancellation failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    requireVenueAccess: true,
    schema: bulkOrderCancelSchema,
    requireRole: ["owner", "manager"],
  }
);

/**
 * DELETE: Bulk complete orders
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
      const validationResult = bulkOrderCompleteSchema.safeParse(body);

      if (!validationResult.success) {
        return handleZodError(validationResult.error);
      }

      const { orderIds, force, dryRun } = validationResult.data;

      logger.info("[bulk/orders] Bulk complete request", {
        venueId,
        orderCount: orderIds.length,
        force,
        dryRun,
      });

      const result = await bulkOperationsService.bulkUpdate<
        OrderUpdateData
      >(
        { type: "bulk_update", venueId, userId, updates: orderIds.map((id) => ({ id, data: { order_status: "COMPLETED", payment_status: "PAID", force_complete: force } })), dryRun },
        { batchSize: 50, batchDelay: 100, maxConcurrency: 5, retryEnabled: true, maxRetries: 3, retryDelay: 1000 }
      );

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
        "Bulk order completion failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    requireVenueAccess: true,
    schema: bulkOrderCompleteSchema,
    requireRole: ["owner", "manager", "staff"],
  }
);

import { createAdminClient } from '@/lib/supabase';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';
import { success, apiErrors } from '@/lib/api/standard-response';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    logger.debug("[STAFF DELETE API] Request received", {
      venueId: context.venueId,
      url: req.url,
    });
    
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        logger.warn("[STAFF DELETE API] Rate limit exceeded");
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      const body = await req.json().catch(() => ({}));
      logger.debug("[STAFF DELETE API] Request body", { body });
      const { id } = body;

      if (!id) {
        logger.warn("[STAFF DELETE API] Validation failed - id is required");
        return apiErrors.badRequest('id required');
      }

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = context.venueId.startsWith("venue-") 
        ? context.venueId 
        : `venue-${context.venueId}`;
      logger.debug("[STAFF DELETE API] Normalized venueId and staff ID", { normalizedVenueId, staffId: id });

      const admin = createAdminClient();

      // Use soft deletion instead of hard deletion for forever count
      const deleteStart = Date.now();
      const { data, error } = await admin
        .from('staff')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('venue_id', normalizedVenueId)
        .select(); // Select to verify deletion
      const deleteTime = Date.now() - deleteStart;
      
      logger.debug("[STAFF DELETE API] Delete query completed", {
        queryTime: `${deleteTime}ms`,
        hasError: !!error,
        rowsAffected: data?.length || 0,
      });
        
      if (error) {
        logger.error("[STAFF DELETE API] Database update failed", {
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          error,
        });
        return apiErrors.badRequest(error.message);
      }
      
      if (!data || data.length === 0) {
        logger.warn("[STAFF DELETE API] No rows updated (staff member not found or already deleted)");
        return apiErrors.notFound("Staff member not found or already deleted");
      }
      
      logger.info("[STAFF DELETE API] Staff member soft-deleted successfully", {
        staffId: id,
        deletedAt: data[0].deleted_at,
      });
      return success({ success: true });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : undefined;
      logger.error("[STAFF DELETE API] Unexpected error", {
        errorType: e instanceof Error ? e.constructor.name : typeof e,
        errorMessage,
        errorStack,
      });
      return apiErrors.internal(errorMessage);
    }
  }
);

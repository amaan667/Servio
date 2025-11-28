import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';

export const runtime = "nodejs";

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Validate venueId
      const venueId = context.venueId;
      if (!venueId) {
        return apiErrors.badRequest("venueId is required");
      }

      // STEP 3: Business logic
      const supabase = createAdminClient();

      try {
        // Get all active group sessions for this venue
        const { data: groupSessions, error } = await supabase
          .from('table_group_sessions')
          .select('*')
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .order('table_number', { ascending: true });

        if (error) {
          if (error.message.includes('does not exist')) {
            logger.info("[GROUP SESSIONS] Table not created yet", {
              venueId,
              userId: context.user.id,
            });
            return success({ 
              groupSessions: [],
              count: 0,
              message: 'Table not created yet - returning empty data'
            });
          }
          logger.error('[GROUP SESSIONS] Error fetching group sessions:', {
            error: error.message,
            venueId,
            userId: context.user.id,
          });
          return apiErrors.database(
            "Failed to fetch group sessions",
            isDevelopment() ? error.message : undefined
          );
        }

        logger.info("[GROUP SESSIONS] Group sessions fetched successfully", {
          venueId,
          count: groupSessions?.length || 0,
          userId: context.user.id,
        });

        // STEP 4: Return success response
        return success({ 
          groupSessions: groupSessions || [],
          count: groupSessions?.length || 0
        });
      } catch (tableError) {
        logger.warn("[GROUP SESSIONS] Table not available", {
          error: tableError instanceof Error ? tableError.message : String(tableError),
          venueId,
          userId: context.user.id,
        });
        return success({ 
          groupSessions: [],
          count: 0,
          message: 'Table not available - returning empty data'
        });
      }
    } catch (error) {
      logger.error('[GROUP SESSIONS] Unexpected error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId: context.venueId,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    // Extract venueId from query
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        return searchParams.get("venueId") || searchParams.get("venue_id");
      } catch {
        return null;
      }
    },
  }
);

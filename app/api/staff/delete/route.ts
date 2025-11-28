import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';
import { success, apiErrors } from '@/lib/api/standard-response';

export const runtime = 'nodejs';

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      const { id } = await req.json().catch(() => ({}));

      if (!id) {
        return apiErrors.badRequest('id required');
      }

      const admin = createAdminClient();

      // Use soft deletion instead of hard deletion for forever count
      const { error } = await admin
        .from('staff')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('venue_id', context.venueId);
        
      if (error) {
        return apiErrors.badRequest(error.message);
      }
      
      return success({ success: true });
    } catch (_error) {
      return apiErrors.internal(
        _error instanceof Error ? _error.message : "Unknown error"
      );
    }
  }
);

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';
import { success, apiErrors } from '@/lib/api/standard-response';

export const runtime = "nodejs";

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

      const body = await req.json().catch(() => ({}));
      const { name, role } = body || {};

      if (!name) {
        return apiErrors.badRequest('name is required');
      }

      const admin = createAdminClient();
      const { data, error } = await admin
        .from("staff")
        .insert([{ venue_id: context.venueId, name, role: role || "Server" }])
        .select("*");
      
      if (error) {
        return apiErrors.badRequest(error.message);
      }
      
      return success({ data: data ?? [] });
    } catch (_e) {
      return apiErrors.internal(
        _e instanceof Error ? _e.message : "Unknown error"
      );
    }
  }
);

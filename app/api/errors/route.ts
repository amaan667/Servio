import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

interface ErrorData {
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  message?: {
    text: string;
    level: string;
  };
  context: {
    userId?: string;
    venueId?: string;
    userRole?: string;
    url: string;
    timestamp: number;
    userAgent: string;
    sessionId: string;
    customData?: Record<string, unknown>;
  };
}

export async function POST(_request: NextRequest) {
  try {
    const req = _request;

    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI();
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const data: ErrorData = await _request.json();

    // Log error/message
    if (data.error) {
      logger.error("[ERROR TRACKING] Error captured:", {
        name: data.error.name,
        message: data.error.message,
        stack: data.error.stack,
        url: data.context.url,
        userId: data.context.userId,
        venueId: data.context.venueId,
        userRole: data.context.userRole,
        sessionId: data.context.sessionId,
        timestamp: new Date(data.context.timestamp).toISOString(),
      });
    } else if (data.message) {
      logger.info(`[ERROR TRACKING] ${data.message.level.toUpperCase()}: ${data.message.text}`, {
        url: data.context.url,
        userId: data.context.userId,
        venueId: data.context.venueId,
        userRole: data.context.userRole,
        sessionId: data.context.sessionId,
        timestamp: new Date(data.context.timestamp).toISOString(),
      });
    }

    // Store in database or send to external service
    // For now, we'll just log it
    // In production, you might want to store this in a database
    // or send it to a service like Sentry, LogRocket, etc.

    // Example: Store in Supabase
    // const supabase = createServerSupabase();
    // await supabase.from('error_logs').insert({
    //   error_name: data.error?.name,
    //   error_message: data.error?.message,
    //   error_stack: data.error?.stack,
    //   message_text: data.message?.text,
    //   message_level: data.message?.level,
    //   url: data.context.url,
    //   user_id: data.context.userId,
    //   venue_id: data.context.venueId,
    //   user_role: data.context.userRole,
    //   session_id: data.context.sessionId,
    //   user_agent: data.context.userAgent,
    //   custom_data: data.context.customData,
    //   created_at: new Date().toISOString(),
    // });

    return NextResponse.json({ success: true });
  } catch (_error) {
    logger.error("[ERROR TRACKING] Failed to process error:", _error as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to process error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Error tracking endpoint",
    status: "active",
  });
}

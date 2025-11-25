import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
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
      const authResult = await requireAuthForAPI(req);
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

    
    const tableNumber = searchParams.get("tableNumber");

    if (!venueId || !tableNumber) {
      return NextResponse.json(
        {
          ok: false,
          error: "venueId and tableNumber are required",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    try {
      // Check for existing group session for this table
      const { data: existingSession, error } = await supabase
        .from("table_group_sessions")
        .select("*")
        .eq("venue_id", venueId)
        .eq("table_number", parseInt(tableNumber))
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (error.message.includes("does not exist")) {
          return NextResponse.json({
            ok: true,
            groupSessionId: null,
            message: "Table not created yet - using fallback mode",
          });
        }
        logger.error("[GROUP SESSION] Error fetching group session:", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json(
          {
            ok: false,
            error: `Failed to fetch group session: ${error.message}`,
          },
          { status: 500 }
        );
      }

      if (existingSession) {
        return NextResponse.json({
          ok: true,
          groupSessionId: existingSession.id,
          totalGroupSize: existingSession.total_group_size,
          currentGroupSize: existingSession.current_group_size,
          session: existingSession,
        });
      }

      return NextResponse.json({
        ok: true,
        groupSessionId: null,
      });
    } catch (tableError) {
      return NextResponse.json({
        ok: true,
        groupSessionId: null,
        message: "Table not available - using fallback mode",
      });
    }
  } catch (_error) {
    logger.error("[GROUP SESSION] Error in GET group session API:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
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
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI(req);
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

    const body = await req.json();
    const { tableNumber, groupSize } = body;
    const finalVenueId = venueId || body.venueId;

    if (!finalVenueId || !tableNumber || !groupSize) {
      return NextResponse.json(
        {
          ok: false,
          error: "finalVenueId, tableNumber, and groupSize are required",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    try {
      // Check for existing group session for this table
      const { data: existingSession, error: fetchError } = await supabase
        .from("table_group_sessions")
        .select("*")
        .eq("venue_id", finalVenueId)
        .eq("table_number", parseInt(tableNumber))
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        if (fetchError.message.includes("does not exist")) {
          return NextResponse.json({
            ok: true,
            groupSessionId: `fallback_${finalVenueId}_${tableNumber}`,
            totalGroupSize: groupSize,
            currentGroupSize: groupSize,
            message: "Table not created yet - using fallback mode",
          });
        }
        logger.error("[GROUP SESSION] Error fetching existing session:", fetchError);
        return NextResponse.json(
          {
            ok: false,
            error: `Failed to fetch existing session: ${fetchError.message}`,
          },
          { status: 500 }
        );
      }

      if (existingSession) {
        // Update existing session with new group size
        const newTotalGroupSize = Math.max(existingSession.total_group_size, groupSize);
        const newCurrentGroupSize = existingSession.current_group_size + groupSize;

        const { data: updatedSession, error: updateError } = await supabase
          .from("table_group_sessions")
          .update({
            total_group_size: newTotalGroupSize,
            current_group_size: newCurrentGroupSize,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSession.id)
          .select()
          .single();

        if (updateError) {
          logger.error("[GROUP SESSION] Error updating group session:", updateError);
          return NextResponse.json(
            {
              ok: false,
              error: `Failed to update group session: ${updateError.message}`,
            },
            { status: 500 }
          );
        }

        // Update table seat count to match new total group size
        await supabase
          .from("tables")
          .update({
            seat_count: newTotalGroupSize,
            updated_at: new Date().toISOString(),
          })
          .eq("venue_id", finalVenueId)
          .eq("label", tableNumber.toString());

        return NextResponse.json({
          ok: true,
          groupSessionId: updatedSession.id,
          totalGroupSize: updatedSession.total_group_size,
          currentGroupSize: updatedSession.current_group_size,
          message: "Joined existing group session",
        });
      } else {
        // Create new group session
        const { data: newSession, error: createError } = await supabase
          .from("table_group_sessions")
          .insert({
            venue_id: finalVenueId,
            table_number: parseInt(tableNumber),
            total_group_size: groupSize,
            current_group_size: groupSize,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) {
          logger.error("[GROUP SESSION] Error creating group session:", createError);
          return NextResponse.json(
            {
              ok: false,
              error: `Failed to create group session: ${createError.message}`,
            },
            { status: 500 }
          );
        }

        // Update table seat count to match group size (if table exists)
        await supabase
          .from("tables")
          .update({
            seat_count: groupSize,
            updated_at: new Date().toISOString(),
          })
          .eq("venue_id", finalVenueId)
          .eq("label", tableNumber.toString());

        return NextResponse.json({
          ok: true,
          groupSessionId: newSession.id,
          totalGroupSize: newSession.total_group_size,
          currentGroupSize: newSession.current_group_size,
          message: "Created new group session",
        });
      }
    } catch (tableError) {
      return NextResponse.json({
        ok: true,
        groupSessionId: `fallback_${finalVenueId}_${tableNumber}`,
        totalGroupSize: groupSize,
        currentGroupSize: groupSize,
        message: "Table not available - using fallback mode",
      });
    }
  } catch (_error) {
    logger.error("[GROUP SESSION] Error in POST group session API:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

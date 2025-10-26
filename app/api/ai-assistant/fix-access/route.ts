// AI Assistant - Fix Access Endpoint
// Ensures user has proper venue role for AI assistant access

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { z } from "zod";
import { logger } from '@/lib/logger';

const FixAccessRequestSchema = z.object({
  venueId: z.string().min(1),
});

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request
    const body = await request.json();
    const { venueId } = FixAccessRequestSchema.parse(body);

    // Check if user_venue_roles table exists and if user already has a role for this venue
    try {
      const { data: existingRole, error: roleError } = await supabase
        .from("user_venue_roles")
        .select("role")
        .eq("venue_id", venueId)
        .eq("user_id", user.id)
        .single();

      if (existingRole && !roleError) {
        return NextResponse.json({
          success: true,
          message: "Access already configured",
          role: existingRole.role,
        });
      }
    } catch (tableError) {
      // Table doesn't exist or other error - we'll create the role anyway
      logger.debug("[AI ASSISTANT] user_venue_roles table check failed:", { error: tableError instanceof Error ? tableError.message : 'Unknown error' });
    }

    // Check if user owns this venue
    const { data: venue } = await supabase
      .from("venues")
      .select("owner_user_id")
      .eq("venue_id", venueId)
      .single();

    if (!venue) {
      return NextResponse.json(
        { error: "Venue not found" },
        { status: 404 }
      );
    }

    // If user owns the venue, create owner role
    if (venue.owner_user_id === user.id) {
      try {
        const { data: roleData, error: roleError } = await supabase
          .from("user_venue_roles")
          .insert({
            user_id: user.id,
            venue_id: venueId,
            role: "owner",
            organization_id: null, // Can be null for single-venue setups
          })
          .select("role")
          .single();

        if (roleError) {
          logger.error("[AI ASSISTANT] Failed to create owner role:", { error: roleError.message || 'Unknown error' });
          // If table doesn't exist, return success anyway since user owns the venue
          if (roleError.message?.includes("relation") && roleError.message?.includes("does not exist")) {
            return NextResponse.json({
              success: true,
              message: "Access configured as owner (legacy mode)",
              role: "owner",
            });
          }
          return NextResponse.json(
            { error: "Failed to configure access" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: "Access configured as owner",
          role: roleData.role,
        });
      } catch (insertError) {
        logger.error("[AI ASSISTANT] Failed to insert owner role:", { error: insertError instanceof Error ? insertError.message : 'Unknown error' });
        // If we can't create the role but user owns venue, allow access anyway
        return NextResponse.json({
          success: true,
          message: "Access configured as owner (legacy mode)",
          role: "owner",
        });
      }
    }

    // User doesn't own venue and has no role - access denied
    return NextResponse.json(
      { error: "No access to this venue" },
      { status: 403 }
    );
  } catch (_error) {
    logger.error("[AI ASSISTANT] Fix access error:", { error: error instanceof Error ? error.message : 'Unknown error' });

    if ((error as any)?.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request format", details: (error as any)?.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fix access" },
      { status: 500 }
    );
  }
}

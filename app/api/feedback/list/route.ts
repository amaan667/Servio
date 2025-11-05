import { NextResponse } from "next/server";
import { authenticateRequest, verifyVenueAccess } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { venue_id } = await req.json();

    if (!venue_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "venue_id is required",
        },
        { status: 400 }
      );
    }

    // Authenticate using Authorization header
    const auth = await authenticateRequest(req);
    if (!auth.success || !auth.user || !auth.supabase) {
      return NextResponse.json(
        {
          ok: false,
          error: auth.error || "Authentication required",
        },
        { status: 401 }
      );
    }

    const { user, supabase: supa } = auth;

    // Verify venue access
    const access = await verifyVenueAccess(supa, user.id, venue_id);
    if (!access.hasAccess) {
      return NextResponse.json(
        {
          ok: false,
          error: "Access denied to this venue",
        },
        { status: 403 }
      );
    }

    // Fetch feedback for orders from this venue
    const { data: feedback, error } = await supa
      .from("order_feedback")
      .select(
        `
        id,
        created_at,
        rating,
        comment,
        order_id,
        orders!inner(venue_id)
      `
      )
      .eq("orders.venue_id", venue_id)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[AUTH DEBUG] Error fetching feedback:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to fetch feedback",
        },
        { status: 500 }
      );
    }

    // Transform the data to match the expected format
    interface FeedbackRow {
      id: string;
      created_at: string;
      rating: number;
      comment: string | null;
      order_id: string;
      orders: { venue_id: string };
    }
    const transformedFeedback =
      (feedback as unknown as FeedbackRow[])?.map((f) => ({
        id: f.id,
        created_at: f.created_at,
        rating: f.rating,
        comment: f.comment,
        order_id: f.order_id,
      })) || [];

    return NextResponse.json({
      ok: true,
      feedback: transformedFeedback,
    });
  } catch (_error) {
    logger.error("[AUTH DEBUG] Error in feedback list:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to fetch feedback: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
      },
      { status: 500 }
    );
  }
}

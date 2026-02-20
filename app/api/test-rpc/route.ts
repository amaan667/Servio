import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return apiErrors.notFound("Not found");
  }

  const internalSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
  if (!internalSecret) {
    return apiErrors.internal("INTERNAL_API_SECRET (or CRON_SECRET) is not configured");
  }

  if (req.headers.get("authorization") !== `Bearer ${internalSecret}`) {
    return apiErrors.unauthorized("Unauthorized");
  }

  try {
    const cookieStore = await cookies();
    const venueId = req.nextUrl.searchParams.get("venueId") || "venue-1e02af4d";

    const supabase = createServerClient(
      env("NEXT_PUBLIC_SUPABASE_URL")!,
      env("NEXT_PUBLIC_SUPABASE_ANON_KEY")!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    // Get user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({
        error: "Not authenticated",
        authError: authError?.message,
        hasUser: !!user,
      });
    }

    // Call RPC
    const { data, error: rpcError } = await supabase.rpc("get_access_context", {
      p_venue_id: venueId,
    });

    return Response.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      venueId,
      rpcResult: {
        data,
        error: rpcError
          ? {
              message: rpcError.message,
              code: rpcError.code,
              details: rpcError.details,
              hint: rpcError.hint,
            }
          : null,
      },
      authUid: user.id,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Internal error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

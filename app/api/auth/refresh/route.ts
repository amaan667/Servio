import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function POST() {
  try {
    const supabase = await createServerSupabase();

    // SECURE: Use getUser() instead of getSession() for authentication check
    // This authenticates the data by contacting the Supabase Auth server
    const {
      data: { user },

    } = await supabase.auth.getUser();

    if (userError) {
      
      return NextResponse.json(
        {

        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {

        },
        { status: 401 }
      );
    }

    // Get session for expires_at if needed
    const {
      data: { session },

    } = await supabase.auth.getSession();

    if (sessionError && !sessionError.message?.includes("refresh_token_not_found")) {
      :", {

    }

    return NextResponse.json({

        user: user, // Use authenticated user from getUser()

      },

  } catch (_error) {
    
    return NextResponse.json(
      {

      },
      { status: 500 }
    );
  }
}

// Also handle GET requests for compatibility
export async function GET() {
  return POST();
}

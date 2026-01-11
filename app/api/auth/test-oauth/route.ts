import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getAuthRedirectUrl } from "@/lib/auth";
import { env, getNodeEnv } from "@/lib/env";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Test OAuth configuration
    const redirectUrl = getAuthRedirectUrl("/auth/callback");

    // Test Supabase connection - use getUser() for secure authentication
    const {
      data: { user },

    } = await supabase.auth.getUser();

    const testResults = {

        NEXT_PUBLIC_SUPABASE_URL: env("NEXT_PUBLIC_SUPABASE_URL")?.substring(0, 20) + "...",

      },

      },

      },

      },

      },
    };

    return NextResponse.json(testResults);
  } catch (_error) {
    return NextResponse.json(
      {

      },
      { status: 500 }
    );
  }
}

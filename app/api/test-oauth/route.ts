import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        flowType: "pkce",
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app'}/auth/callback`,
      },
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    return NextResponse.json({ success: true, url: data.url });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}

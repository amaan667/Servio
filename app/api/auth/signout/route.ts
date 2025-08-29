import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // allowed in a route handler
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          // allowed in a route handler
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );

  await supabase.auth.signOut({ scope: "local" }); // clears auth cookies
  return NextResponse.json({ ok: true });
}

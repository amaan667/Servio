import { env } from "@/lib/env";
import { success } from "@/lib/api/standard-response";

export async function GET() {
  const body = {
    NEXT_PUBLIC_SITE_URL: env("NEXT_PUBLIC_SITE_URL"),
    APP_URL: env("APP_URL"),
    NEXT_PUBLIC_SUPABASE_URL: env("NEXT_PUBLIC_SUPABASE_URL"),
    HAS_SUPABASE_ANON: !!env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    TIP: "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in Railway.",
  };
  return success(body);
}

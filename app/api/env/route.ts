export async function GET() {
  const body = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    APP_URL: process.env.APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    HAS_SUPABASE_ANON: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    TIP: 'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in Railway.'
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { 'content-type': 'application/json' } });
}

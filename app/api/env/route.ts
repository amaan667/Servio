export async function GET() {
  return new Response(
    JSON.stringify(
      {
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        APP_URL: process.env.APP_URL,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 25) + '...',
      },
      null,
      2
    ),
    { headers: { 'content-type': 'application/json' } }
  );
}

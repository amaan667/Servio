export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { handleAuthSession } from '@supabase/auth-helpers-nextjs'; // npm i @supabase/auth-helpers-nextjs

export async function GET(req: Request) {
  // 1) Let Supabase set the auth cookies on this origin
  const resWithCookies = await handleAuthSession(req); // 200 response with Set-Cookie

  // 2) Preserve those Set-Cookie headers while redirecting to /dashboard
  const redirect = NextResponse.redirect(
    new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL!)
  );
  // copy ALL headers (esp. Set-Cookie) from resWithCookies to redirect
  resWithCookies.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      // multiple Set-Cookie headers are possible
      redirect.headers.append(key, value);
    }
  });

  return redirect;
}

// Some IdPs POST back; handle it the same way
export async function POST(req: Request) {
  const resWithCookies = await handleAuthSession(req);
  return resWithCookies;
}

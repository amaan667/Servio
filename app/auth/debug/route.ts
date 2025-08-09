import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const all = cookies().getAll();
  const sb = all.find((c) => c.name.includes('-auth-token')) ?? null;
  return NextResponse.json({
    cookieNames: all.map((c) => c.name),
    hasSupabaseAuthCookie: !!sb,
  });
}

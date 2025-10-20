import { NextResponse } from 'next/server';

// This route is now disabled - OAuth exchange is handled in /auth/callback/route.ts
export async function POST() {
  return NextResponse.json({ 
    error: 'This endpoint is disabled. OAuth exchange is now handled server-side in the callback route.' 
  }, { status: 410 });
}

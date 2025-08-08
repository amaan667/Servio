import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";

    // Forward the full query string (code, state, error, etc.) to the client at the site root
    const redirectUrl = `${baseUrl}/?${searchParams.toString()}`;
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Auth callback error:', error);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";
    return NextResponse.redirect(`${baseUrl}/sign-in?error=callback_error`);
  }
}
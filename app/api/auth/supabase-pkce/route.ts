import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = false;

function maskValue(value: string | null | undefined, opts: { prefix?: number; suffix?: number } = {}) {
  if (!value) return { present: false };
  const prefix = opts.prefix ?? 6;
  const suffix = opts.suffix ?? 4;
  const len = value.length;
  const masked = len > prefix + suffix
    ? `${value.slice(0, prefix)}...${value.slice(-suffix)}`
    : `${value.slice(0, Math.min(prefix, len))}`;
  return { present: true, length: len, preview: masked };
}

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  
  try {
    const body = await req.json().catch(() => ({}));
    const authCode: string | undefined = body?.auth_code;
    const codeVerifier: string | undefined = body?.code_verifier;

    console.log('[Supabase PKCE] Request received', {
      hasAuthCode: !!authCode,
      hasCodeVerifier: !!codeVerifier,
      authCodeType: typeof authCode,
      codeVerifierType: typeof codeVerifier,
      timestamp,
    });

    // Validate required parameters
    if (!authCode) {
      console.error('[Supabase PKCE] Missing auth_code', { timestamp });
      return NextResponse.json({ error: 'missing_code' }, { status: 400 });
    }

    if (!codeVerifier) {
      console.error('[Supabase PKCE] Missing code_verifier', { timestamp });
      return NextResponse.json({ error: 'missing_code_verifier' }, { status: 400 });
    }

    // Validate parameter types
    if (typeof authCode !== 'string') {
      console.error('[Supabase PKCE] Invalid auth_code type', { type: typeof authCode, timestamp });
      return NextResponse.json({ error: 'invalid_auth_code_type' }, { status: 400 });
    }

    if (typeof codeVerifier !== 'string') {
      console.error('[Supabase PKCE] Invalid code_verifier type', { type: typeof codeVerifier, timestamp });
      return NextResponse.json({ error: 'invalid_code_verifier_type' }, { status: 400 });
    }

    // Get Supabase configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Supabase PKCE] Missing Supabase configuration', {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
        timestamp,
      });
      return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
    }

    // Prepare the payload exactly as Supabase expects it
    const payload = {
      auth_code: authCode,
      code_verifier: codeVerifier,
    };

    console.log('[Supabase PKCE] Sending payload to Supabase', {
      authCode: maskValue(authCode),
      codeVerifier: maskValue(codeVerifier),
      payloadKeys: Object.keys(payload),
      timestamp,
    });

    // Make the request to Supabase's token endpoint
    const tokenUrl = `${supabaseUrl}/auth/v1/token?grant_type=pkce`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const responseData = await response.json().catch(() => ({}));

    console.log('[Supabase PKCE] Supabase response', {
      status: response.status,
      ok: response.ok,
      hasError: !!responseData.error,
      error: responseData.error,
      errorDescription: responseData.error_description,
      hasAccessToken: !!responseData.access_token,
      hasRefreshToken: !!responseData.refresh_token,
      hasUser: !!responseData.user,
      timestamp,
    });

    // Return the response from Supabase
    return NextResponse.json(responseData, { status: response.status });

  } catch (error: any) {
    console.error('[Supabase PKCE] Exception occurred', {
      message: error?.message,
      stack: error?.stack,
      timestamp,
    });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
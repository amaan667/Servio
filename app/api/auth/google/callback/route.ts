import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = false;

function trimEndingArtifacts(value: string | undefined | null) {
  if (!value) return '';
  return value.trim().replace(/[;\s]+$/g, '');
}

function sanitizeRedirectUri(rawRedirectUri: string | undefined, reqUrl: string) {
  const cleaned = trimEndingArtifacts(rawRedirectUri || '');
  if (cleaned) {
    try {
      const u = new URL(cleaned);
      // Return fully-qualified URL with any trailing artifacts removed
      return u.toString().replace(/[;\s]+$/g, '');
    } catch (_) {
      // Fall through to origin-based construction
    }
  }
  // Fallback: build from request origin
  const origin = new URL(reqUrl).origin;
  return `${origin}/auth/callback`;
}

function mask(value: string | null | undefined, prefix = 6, suffix = 4) {
  if (!value) return { present: false };
  const len = value.length;
  const preview = len > prefix + suffix ? `${value.slice(0, prefix)}...${value.slice(-suffix)}` : value;
  return { present: true, length: len, preview };
}

function sanitizeTokenResponse(json: any) {
  if (!json || typeof json !== 'object') return json;
  const { access_token, refresh_token, id_token, ...rest } = json;
  return {
    ...rest,
    hasAccessToken: !!access_token,
    hasRefreshToken: !!refresh_token,
    id_token_present: !!id_token,
  };
}

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    const body = await req.json().catch(() => ({}));
    const code: string | undefined = body?.auth_code || body?.code;
    const verifier: string | undefined = body?.verifier;

    console.log('[OAuth Backend] /api/auth/google/callback POST body', {
      hasCode: !!code,
      hasVerifier: !!verifier,
      timestamp,
    });

    if (!code || !verifier) {
      console.error('[OAuth Backend] Missing code or verifier', { hasCode: !!code, hasVerifier: !!verifier });
      return NextResponse.json({ error: 'missing_code_or_verifier' }, { status: 400 });
    }

    const clientId = trimEndingArtifacts(process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID);
    const clientSecret = trimEndingArtifacts(process.env.GOOGLE_OAUTH_CLIENT_SECRET);
    const redirectUri = sanitizeRedirectUri(
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
        (process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` : ''),
      req.url
    );

    const tokenUrl = 'https://oauth2.googleapis.com/token';

    const payload = new URLSearchParams();
    payload.set('grant_type', 'authorization_code');
    payload.set('code', code);
    payload.set('redirect_uri', redirectUri || '');
    // Guard against missing client_id to avoid confusing Google errors
    if (!clientId) {
      console.error('[OAuth Backend] Missing GOOGLE_OAUTH_CLIENT_ID configuration', {
        timestamp,
        envs: {
          GOOGLE_OAUTH_CLIENT_ID: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
          NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: !!process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
          GOOGLE_OAUTH_REDIRECT_URI: !!process.env.GOOGLE_OAUTH_REDIRECT_URI,
          NEXT_PUBLIC_SITE_URL: !!process.env.NEXT_PUBLIC_SITE_URL,
        },
      });
      return NextResponse.json(
        { error: 'missing_client_id_config', error_description: 'GOOGLE_OAUTH_CLIENT_ID (or NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID) is not set on the server.' },
        { status: 400 }
      );
    }
    payload.set('client_id', clientId);
    payload.set('code_verifier', verifier);
    if (clientSecret) {
      payload.set('client_secret', clientSecret);
    }

    console.log('[OAuth Backend] Token request payload (masked)', {
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      client_id: mask(clientId),
      hasCode: !!code,
      hasVerifier: !!verifier,
      includesClientSecret: !!clientSecret,
      timestamp,
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
      // Do not cache token responses
      cache: 'no-store',
    });

    const json = await res.json().catch(() => ({}));

    // Log error details if present
    if (!res.ok || json?.error) {
      console.error('[OAuth ERROR]', {
        status: res.status,
        error: json?.error,
        error_description: json?.error_description,
        timestamp,
      });
    }

    console.log('[OAuth Backend] Google token response (sanitized)', sanitizeTokenResponse(json));

    // Return a sanitized response to the client as well
    return NextResponse.json(sanitizeTokenResponse(json), { status: res.status });
  } catch (err: any) {
    console.error('[OAuth Exception]', {
      message: err?.message,
      stack: err?.stack,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}


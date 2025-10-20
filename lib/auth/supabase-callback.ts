import { createClient } from "@supabase/supabase-js";
import { authLogger as logger } from '@/lib/logger';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function handleGoogleCallback(req: unknown, res: unknown) {
  // code can be array-like in some frameworks; ensure it's a string
  const rawCode = req.query?.code;
  const authCode = Array.isArray(rawCode) ? rawCode[0] : rawCode;

  // verifier must be the exact string you generated before redirect
  const rawVerifier = req.session?.pkce_verifier;
  const codeVerifier = Array.isArray(rawVerifier) ? rawVerifier[0] : rawVerifier;

  // Add the suggested debugging logs

  if (!authCode || typeof authCode !== "string") {
    logger.error('[OAuth Backend] Missing or invalid code', { 
      hasCode: !!authCode, 
      type: typeof authCode,
      value: authCode?.slice(0, 12) + "..." 
    });
    return res.status(400).json({ error: "Missing or invalid code" });
  }
  
  if (!codeVerifier || typeof codeVerifier !== "string") {
    logger.error('[OAuth Backend] Missing PKCE verifier in session', { 
      hasVerifier: !!codeVerifier, 
      type: typeof codeVerifier,
      length: codeVerifier?.length 
    });
    return res.status(400).json({ error: "Missing PKCE verifier in session" });
  }

  try {
    const payload: unknown = {
      code: authCode,
      code_verifier: codeVerifier,
    };

    // If a redirect_uri was used during sign-in, include it here as well
    const redirectUri = process.env.OAUTH_REDIRECT_URI;
    if (redirectUri) {
      payload.redirect_uri = redirectUri;
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(payload);

    if (error) {
      // Typical: invalid_grant if verifier mismatches or code reused/expired
      logger.error("[OAuth ERROR]", {
        error: error.message,
        code: error.code,
        status: error.status,
        authCodePreview: authCode.slice(0, 12) + "...",
        verifierLength: codeVerifier.length
      });
      return res.status(400).json({ error: error.message });
    }

    // Optionally: set your own httpOnly cookies here if you want server-managed auth
    // const { session } = data;

    logger.debug("[OAuth Success]", {
      hasSession: !!data.session,
      hasUser: !!data.user,
      sessionExpiresAt: data.session?.expires_at,
      userEmail: data.user?.email
    });

    return res.json(data);
  } catch (err: unknown) {
    logger.error("[OAuth Exception]", {
      message: err.message,
      stack: err.stack,
      authCodePreview: authCode.slice(0, 12) + "...",
      verifierLength: codeVerifier.length
    });
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
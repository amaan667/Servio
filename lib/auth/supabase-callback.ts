import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function handleGoogleCallback(req: any, res: any) {
  // code can be array-like in some frameworks; ensure it's a string
  const rawCode = req.query?.code;
  const authCode = Array.isArray(rawCode) ? rawCode[0] : rawCode;

  // verifier must be the exact string you generated before redirect
  const rawVerifier = req.session?.pkce_verifier;
  const codeVerifier = Array.isArray(rawVerifier) ? rawVerifier[0] : rawVerifier;

  // Add the suggested debugging logs
  console.log("authCode typeof/value:", typeof authCode, authCode?.slice(0, 12), "...");
  console.log("codeVerifier typeof/len:", typeof codeVerifier, codeVerifier?.length);

  if (!authCode || typeof authCode !== "string") {
    console.error('[OAuth Backend] Missing or invalid code', { 
      hasCode: !!authCode, 
      type: typeof authCode,
      value: authCode?.slice(0, 12) + "..." 
    });
    return res.status(400).json({ error: "Missing or invalid code" });
  }
  
  if (!codeVerifier || typeof codeVerifier !== "string") {
    console.error('[OAuth Backend] Missing PKCE verifier in session', { 
      hasVerifier: !!codeVerifier, 
      type: typeof codeVerifier,
      length: codeVerifier?.length 
    });
    return res.status(400).json({ error: "Missing PKCE verifier in session" });
  }

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession({
      authCode,
      codeVerifier,
    });

    if (error) {
      // Typical: invalid_grant if verifier mismatches or code reused/expired
      console.error("[OAuth ERROR]", {
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

    console.log("[OAuth SUCCESS]", {
      hasSession: !!data.session,
      hasUser: !!data.user,
      sessionExpiresAt: data.session?.expires_at,
      userEmail: data.user?.email
    });

    return res.json(data);
  } catch (err: any) {
    console.error("[OAuth Exception]", {
      message: err.message,
      stack: err.stack,
      authCodePreview: authCode.slice(0, 12) + "...",
      verifierLength: codeVerifier.length
    });
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
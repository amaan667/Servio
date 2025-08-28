"use client";
import { createClient } from "@/lib/sb-client";
import { siteOrigin } from "@/lib/site";

export async function signInWithGoogle() {
  const sb = createClient();
  const origin = siteOrigin();
  const redirectUrl = `${origin}/auth/callback`;

  console.log('[AUTH DEBUG] signInWithGoogle: starting', { 
    origin,
    redirectUrl, 
    windowOrigin: typeof window !== 'undefined' ? window.location.origin : 'undefined',
    envSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'undefined',
    timestamp: new Date().toISOString()
  });

  try {
    // Clear stale PKCE artifacts to avoid verifier/code mismatches
    const clearedKeys: string[] = [];
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier")) {
        localStorage.removeItem(k);
        clearedKeys.push(k);
      }
    });
    sessionStorage.removeItem("sb_oauth_retry");
    
    console.log('[AUTH DEBUG] signInWithGoogle: cleared keys', { clearedKeys });

    // Ensure we're starting with a clean state
    await sb.auth.signOut({ scope: 'local' });

    // Wait a moment for storage to clear, especially important for mobile browsers
    await new Promise(resolve => setTimeout(resolve, 200));

    // Enhanced PKCE initialization with retry mechanism
    let oauthResponse = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`[AUTH DEBUG] signInWithGoogle: attempt ${retryCount + 1}/${maxRetries}`);
        
        const { data, error } = await sb.auth.signInWithOAuth({
          provider: "google",
          options: {
            flowType: "pkce",
            redirectTo: redirectUrl,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });

        if (error) {
          throw error;
        }

        if (!data?.url) {
          throw new Error('No redirect URL received from OAuth provider');
        }

        oauthResponse = data;
        console.log('[AUTH DEBUG] signInWithGoogle: OAuth response received', { 
          hasData: !!data, 
          urlLength: data?.url?.length,
          timestamp: new Date().toISOString()
        });

        // Enhanced verifier check with multiple storage checks
        const verifierCheck = await checkPKCEVerifier();
        
        if (verifierCheck.success) {
          console.log('[AUTH DEBUG] signInWithGoogle: PKCE verifier confirmed, proceeding with redirect');
          break;
        } else {
          console.log('[AUTH DEBUG] signInWithGoogle: PKCE verifier not found, retrying...', verifierCheck);
          retryCount++;
          
          if (retryCount < maxRetries) {
            // Wait longer between retries for mobile browsers
            await new Promise(resolve => setTimeout(resolve, 1000 + (retryCount * 500)));
          }
        }
      } catch (attemptError: any) {
        console.error(`[AUTH DEBUG] signInWithGoogle: attempt ${retryCount + 1} failed`, attemptError);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          throw attemptError;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!oauthResponse) {
      throw new Error('Failed to initialize OAuth after multiple attempts');
    }

    // Final verifier check before redirect
    const finalVerifierCheck = await checkPKCEVerifier();
    if (!finalVerifierCheck.success) {
      console.error('[AUTH DEBUG] signInWithGoogle: PKCE verifier still not found after all attempts', finalVerifierCheck);
      throw new Error('PKCE verifier not properly initialized after multiple attempts');
    }

    // Store a flag to indicate OAuth is in progress (useful for debugging)
    sessionStorage.setItem("sb_oauth_in_progress", "true");
    sessionStorage.setItem("sb_oauth_start_time", Date.now().toString());

    // The redirect should happen automatically, but let's ensure it does
    console.log('[AUTH DEBUG] signInWithGoogle: redirecting to', oauthResponse.url);
    
    // Use window.location.href for better mobile browser compatibility
    window.location.href = oauthResponse.url;
    
  } catch (error: any) {
    console.error('[AUTH DEBUG] signInWithGoogle: error', { 
      message: error?.message, 
      name: error?.name,
      timestamp: new Date().toISOString()
    });
    
    // Clear any OAuth progress flags on error
    sessionStorage.removeItem("sb_oauth_in_progress");
    sessionStorage.removeItem("sb_oauth_start_time");
    
    throw error;
  }
}

// Enhanced PKCE verifier check function
async function checkPKCEVerifier() {
  try {
    // Check for the specific Supabase PKCE verifier
    const verifier = localStorage.getItem("supabase.auth.token-code-verifier");
    
    // Check for any PKCE-related keys
    const allKeys = Object.keys(localStorage);
    const pkceKeys = allKeys.filter(k => 
      k.includes("pkce") || 
      k.includes("token-code-verifier") || 
      k.includes("code_verifier") ||
      k.startsWith("sb-")
    );
    
    // Check sessionStorage as well
    const sessionKeys = Object.keys(sessionStorage);
    const sessionPkceKeys = sessionKeys.filter(k => 
      k.includes("pkce") || 
      k.includes("verifier") || 
      k.includes("code_verifier") ||
      k.startsWith("sb-")
    );
    
    const hasVerifier = !!verifier;
    const hasPkceKeys = pkceKeys.length > 0;
    const hasSessionPkceKeys = sessionPkceKeys.length > 0;
    
    console.log('[AUTH DEBUG] checkPKCEVerifier: detailed check', { 
      hasVerifier, 
      hasPkceKeys,
      hasSessionPkceKeys,
      verifierLength: verifier?.length,
      pkceKeys,
      sessionPkceKeys,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: hasVerifier || hasPkceKeys || hasSessionPkceKeys,
      hasVerifier,
      hasPkceKeys,
      hasSessionPkceKeys,
      verifierLength: verifier?.length,
      pkceKeys,
      sessionPkceKeys
    };
  } catch (err) { 
    console.log('[AUTH DEBUG] checkPKCEVerifier: check failed', { error: err });
    return { 
      success: false, 
      error: err,
      hasVerifier: false,
      hasPkceKeys: false,
      hasSessionPkceKeys: false
    }; 
  }
}

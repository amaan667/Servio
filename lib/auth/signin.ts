"use client";
import { createClient } from "@/lib/sb-client";
import { siteOrigin } from "@/lib/site";
import { clearPkceVerifier } from './pkce-utils.js';

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

function sanitizeUrlMaskClientId(urlString: string | null | undefined) {
  if (!urlString) return { url: urlString };
  try {
    const u = new URL(urlString);
    if (u.searchParams.has('client_id')) {
      const cid = u.searchParams.get('client_id');
      const masked = maskValue(cid);
      if (cid) u.searchParams.set('client_id', masked.preview || '***');
    }
    return { url: u.toString() };
  } catch {
    return { url: urlString };
  }
}

// Enhanced mobile detection
function isMobileBrowser() {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent);
}

// Enhanced storage verification for mobile browsers
function verifyStorageSync() {
  try {
    const testKey = 'mobile_storage_test_' + Date.now();
    const testValue = 'test_value_' + Math.random();
    
    // Test localStorage
    localStorage.setItem(testKey, testValue);
    const localStorageResult = localStorage.getItem(testKey) === testValue;
    localStorage.removeItem(testKey);
    
    // Test sessionStorage
    sessionStorage.setItem(testKey, testValue);
    const sessionStorageResult = sessionStorage.getItem(testKey) === testValue;
    sessionStorage.removeItem(testKey);
    
    return { localStorage: localStorageResult, sessionStorage: sessionStorageResult };
  } catch (error) {
    console.log('[AUTH DEBUG] Storage sync test failed:', error);
    return { localStorage: false, sessionStorage: false };
  }
}

export async function signInWithGoogle() {
  const sb = createClient();
  const origin = siteOrigin();
  const redirectUrl = `${origin}/auth/callback`;
  const isMobile = isMobileBrowser();

  console.log('[AUTH DEBUG] signInWithGoogle: starting', { 
    origin,
    redirectUrl, 
    isMobile,
    windowOrigin: typeof window !== 'undefined' ? window.location.origin : 'undefined',
    envSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'undefined',
    timestamp: new Date().toISOString()
  });

  try {
    // Enhanced storage clearing for cross-platform compatibility
    const clearedKeys: string[] = [];
    
    // Clear localStorage with comprehensive key detection
    const localStorageKeys = Object.keys(localStorage).filter(k => 
      k.startsWith("sb-") || 
      k.includes("pkce") || 
      k.includes("token-code-verifier") || 
      k.includes("code_verifier") ||
      k.includes("auth") ||
      k.includes("verifier")
    );
    localStorageKeys.forEach(k => {
      localStorage.removeItem(k);
      clearedKeys.push(`local:${k}`);
    });
    
    // Clear sessionStorage with comprehensive key detection
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      k.startsWith("sb-") || 
      k.includes("pkce") || 
      k.includes("token-code-verifier") || 
      k.includes("code_verifier") ||
      k.includes("auth") ||
      k.includes("verifier") ||
      k.includes("oauth")
    );
    sessionStorageKeys.forEach(k => {
      sessionStorage.removeItem(k);
      clearedKeys.push(`session:${k}`);
    });
    
    // Clear our custom PKCE verifier from all locations
    clearPkceVerifier();
    
    console.log('[AUTH DEBUG] signInWithGoogle: cleared keys', { 
      clearedKeys, 
      isMobile,
      localStorageCount: localStorageKeys.length,
      sessionStorageCount: sessionStorageKeys.length
    });

    // Ensure we're starting with a clean state
    await sb.auth.signOut({ scope: 'local' });

    // Enhanced delay for mobile browsers - they need more time for storage operations
    const storageDelay = isMobile ? 800 : 200; // Increased delay for mobile
    console.log('[AUTH DEBUG] signInWithGoogle: waiting for storage to clear', { delay: storageDelay, isMobile });
    await new Promise(resolve => setTimeout(resolve, storageDelay));

    // Verify storage is working properly on mobile
    if (isMobile) {
      const storageTest = verifyStorageSync();
      console.log('[AUTH DEBUG] signInWithGoogle: storage sync test', storageTest);
      
      if (!storageTest.localStorage || !storageTest.sessionStorage) {
        console.warn('[AUTH DEBUG] signInWithGoogle: storage sync issues detected on mobile');
        // Try to recover by clearing storage again
        try {
          localStorage.clear();
          sessionStorage.clear();
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('[AUTH DEBUG] signInWithGoogle: storage cleared again for mobile recovery');
        } catch (error) {
          console.error('[AUTH DEBUG] signInWithGoogle: failed to clear storage for mobile recovery', error);
        }
      }
    }

    // Use Supabase's built-in PKCE flow with enhanced mobile support
    console.log('[OAuth Frontend] Using Supabase built-in PKCE flow with mobile optimizations');

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

    console.log('[AUTH DEBUG] signInWithGoogle: OAuth response', { 
      hasData: !!data, 
      hasError: !!error, 
      errorMessage: error?.message,
      url: data?.url,
      urlLength: data?.url?.length,
      isMobile,
      timestamp: new Date().toISOString()
    });

    if (error) {
      throw error;
    }

    if (!data?.url) {
      throw new Error('No redirect URL received from OAuth provider');
    }

    // Enhanced PKCE verifier verification with mobile-specific handling
    const verifierCheck = (() => {
      try {
        // Check for Supabase's PKCE verifier
        const verifier = localStorage.getItem("supabase.auth.token-code-verifier");
        
        // Check for any PKCE-related keys
        const pkceKeys = Object.keys(localStorage).filter(k => 
          k.includes("pkce") || k.includes("token-code-verifier") || k.includes("code_verifier")
        );
        
        // Check for Supabase auth keys
        const supabaseKeys = Object.keys(localStorage).filter(k => k.startsWith("sb-"));
        
        console.log('[AUTH DEBUG] signInWithGoogle: verifier check before redirect', { 
          hasVerifier: !!verifier, 
          verifierLength: verifier?.length,
          pkceKeys,
          supabaseKeys,
          isMobile,
          timestamp: new Date().toISOString()
        });
        
        // On mobile, we're more lenient with verifier checks due to storage sync delays
        if (isMobile) {
          const hasAnyPkceData = !!verifier || pkceKeys.length > 0 || supabaseKeys.length > 0;
          console.log('[AUTH DEBUG] signInWithGoogle: mobile verifier check result', { hasAnyPkceData });
          return hasAnyPkceData;
        }
        
        return !!verifier || pkceKeys.length > 0;
      } catch (err) { 
        console.log('[AUTH DEBUG] signInWithGoogle: verifier check failed', { error: err, isMobile });
        // On mobile, don't fail immediately if verifier check fails
        return isMobile;
      }
    })();

    if (!verifierCheck) {
      console.error('[AUTH DEBUG] signInWithGoogle: PKCE verifier not found before redirect');
      
      // On mobile, try one more time with a longer delay
      if (isMobile) {
        console.log('[AUTH DEBUG] signInWithGoogle: retrying verifier check on mobile after delay');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Increased delay
        
        const retryVerifier = localStorage.getItem("supabase.auth.token-code-verifier");
        const retryPkceKeys = Object.keys(localStorage).filter(k => 
          k.includes("pkce") || k.includes("token-code-verifier") || k.includes("code_verifier")
        );
        
        console.log('[AUTH DEBUG] signInWithGoogle: mobile retry verifier check', {
          hasRetryVerifier: !!retryVerifier,
          retryPkceKeys,
          isMobile
        });
        
        if (!retryVerifier && retryPkceKeys.length === 0) {
          // Try one final recovery attempt
          console.log('[AUTH DEBUG] signInWithGoogle: final mobile recovery attempt');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const finalVerifier = localStorage.getItem("supabase.auth.token-code-verifier");
          if (!finalVerifier) {
            throw new Error('PKCE verifier not properly initialized on mobile device after multiple attempts');
          }
        }
      } else {
        throw new Error('PKCE verifier not properly initialized');
      }
    }

    // Store OAuth progress flags with mobile-specific handling
    sessionStorage.setItem("sb_oauth_in_progress", "true");
    sessionStorage.setItem("sb_oauth_start_time", Date.now().toString());
    sessionStorage.setItem("sb_oauth_mobile", isMobile.toString());

    // Log the exact Google OAuth URL with masked client_id for debugging
    try {
      const sanitized = sanitizeUrlMaskClientId(data.url);
      console.log('[OAuth Frontend] Redirecting to Google OAuth URL (sanitized client_id)', { 
        url: sanitized.url,
        isMobile 
      });
    } catch {}

    // Enhanced redirect handling for mobile browsers
    console.log('[AUTH DEBUG] signInWithGoogle: redirecting to', data.url);
    
    // Use window.location.href for better mobile browser compatibility
    // Add a small delay for mobile browsers to ensure all storage operations are complete
    if (isMobile) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    window.location.href = data.url;
    
  } catch (error: any) {
    console.error('[AUTH DEBUG] signInWithGoogle: error', { 
      message: error?.message, 
      name: error?.name,
      isMobile,
      timestamp: new Date().toISOString()
    });
    
    // Clear any OAuth progress flags on error
    sessionStorage.removeItem("sb_oauth_in_progress");
    sessionStorage.removeItem("sb_oauth_start_time");
    sessionStorage.removeItem("sb_oauth_mobile");
    
    throw error;
  }
}

// PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0
// These functions help generate and manage PKCE verifiers and challenges

/**
 * Generate a random code verifier for PKCE
 * @returns {string} A random string of 43-128 characters
 */
export function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64URLEncode(array);
  try {
    console.log('[OAuth Frontend] Generated PKCE verifier', {
      length: verifier.length,
      timestamp: new Date().toISOString()
    });
  } catch {}
  return verifier;
}

/**
 * Generate a code challenge from a code verifier
 * @param {string} verifier - The code verifier
 * @returns {Promise<string>} The code challenge
 */
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

/**
 * Base64URL encode a Uint8Array
 * @param {Uint8Array} buffer - The buffer to encode
 * @returns {string} The base64URL encoded string
 */
function base64URLEncode(buffer) {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Store PKCE verifier in session storage with cross-platform fallback
 * @param {string} verifier - The code verifier to store
 */
export function storePkceVerifier(verifier) {
  try {
    // Store in sessionStorage as primary location
    sessionStorage.setItem('pkce_verifier', verifier);
    
    // Also store in localStorage as backup for better cross-platform compatibility
    try {
      localStorage.setItem('pkce_verifier_backup', verifier);
    } catch (localError) {
      console.log('[OAuth Frontend] Failed to backup verifier to localStorage:', localError);
    }
    
    console.log('[OAuth Frontend] Stored PKCE verifier with cross-platform backup', {
      hasVerifier: !!verifier,
      verifierLength: verifier?.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[OAuth Frontend] Failed to store PKCE verifier:', error);
  }
}

/**
 * Retrieve PKCE verifier from session storage with cross-platform fallback
 * @returns {string|null} The stored verifier or null if not found
 */
export function getPkceVerifier() {
  try {
    // Try sessionStorage first
    let verifier = sessionStorage.getItem('pkce_verifier');
    
    // If not found in sessionStorage, try localStorage backup
    if (!verifier) {
      try {
        verifier = localStorage.getItem('pkce_verifier_backup');
        if (verifier) {
          console.log('[OAuth Frontend] Retrieved PKCE verifier from localStorage backup');
        }
      } catch (localError) {
        console.log('[OAuth Frontend] Failed to check localStorage backup:', localError);
      }
    }
    
    console.log('[OAuth Frontend] Retrieved PKCE verifier with cross-platform fallback', {
      hasVerifier: !!verifier,
      verifierLength: verifier?.length,
      source: verifier ? (sessionStorage.getItem('pkce_verifier') ? 'sessionStorage' : 'localStorage') : 'none',
      timestamp: new Date().toISOString()
    });
    return verifier;
  } catch (error) {
    console.error('[OAuth Frontend] Failed to retrieve PKCE verifier:', error);
    return null;
  }
}

/**
 * Clear PKCE verifier from all storage locations
 */
export function clearPkceVerifier() {
  try {
    // Clear from sessionStorage
    sessionStorage.removeItem('pkce_verifier');
    
    // Clear from localStorage backup
    try {
      localStorage.removeItem('pkce_verifier_backup');
    } catch (localError) {
      console.log('[OAuth Frontend] Failed to clear localStorage backup:', localError);
    }
    
    console.log('[OAuth Frontend] Cleared PKCE verifier from all storage locations');
  } catch (error) {
    console.error('[OAuth Frontend] Failed to clear PKCE verifier:', error);
  }
}
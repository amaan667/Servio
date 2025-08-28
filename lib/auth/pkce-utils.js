// PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0
// These functions help generate and manage PKCE verifiers and challenges

/**
 * Generate a random code verifier for PKCE
 * @returns {string} A random string of 43-128 characters
 */
export function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
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
 * Store PKCE verifier in session storage
 * @param {string} verifier - The code verifier to store
 */
export function storePkceVerifier(verifier) {
  try {
    sessionStorage.setItem('pkce_verifier', verifier);
    console.log('[PKCE Utils] Stored verifier in sessionStorage:', {
      hasVerifier: !!verifier,
      verifierLength: verifier?.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[PKCE Utils] Failed to store verifier:', error);
  }
}

/**
 * Retrieve PKCE verifier from session storage
 * @returns {string|null} The stored verifier or null if not found
 */
export function getPkceVerifier() {
  try {
    const verifier = sessionStorage.getItem('pkce_verifier');
    console.log('[PKCE Utils] Retrieved verifier from sessionStorage:', {
      hasVerifier: !!verifier,
      verifierLength: verifier?.length,
      timestamp: new Date().toISOString()
    });
    return verifier;
  } catch (error) {
    console.error('[PKCE Utils] Failed to retrieve verifier:', error);
    return null;
  }
}

/**
 * Clear PKCE verifier from session storage
 */
export function clearPkceVerifier() {
  try {
    sessionStorage.removeItem('pkce_verifier');
    console.log('[PKCE Utils] Cleared verifier from sessionStorage');
  } catch (error) {
    console.error('[PKCE Utils] Failed to clear verifier:', error);
  }
}
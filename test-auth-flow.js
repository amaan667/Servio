// Test script to verify authentication configuration
// Run this in the browser console to check auth setup

console.log('🔧 === AUTH FLOW TEST SCRIPT ===');

// Test 1: Environment Variables
console.log('Test 1: Environment Variables');
console.log({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://servio-production.up.railway.app',
  NODE_ENV: process.env.NODE_ENV
});

// Test 2: Browser Info
console.log('Test 2: Browser Info');
console.log({
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  cookieEnabled: navigator.cookieEnabled,
  onLine: navigator.onLine,
  currentUrl: window.location.href,
  currentOrigin: window.location.origin
});

// Test 3: Storage State
console.log('Test 3: Storage State');
const authKeys = Object.keys(localStorage).filter(k => 
  k.includes('auth') || k.includes('sb-') || k.includes('pkce')
);
console.log({
  localStorageKeys: Object.keys(localStorage).length,
  authKeys: authKeys,
  sessionStorageKeys: Object.keys(sessionStorage).length
});

// Test 4: Supabase Client (if available)
console.log('Test 4: Supabase Client Test');
if (typeof window !== 'undefined' && window.supabase) {
  console.log('✓ Supabase client available in window object');
} else {
  console.log('✗ Supabase client not available in window object');
}

// Test 5: OAuth URL Generation Test
console.log('Test 5: OAuth URL Generation Test');
async function testOAuthUrl() {
  try {
    // Try to import and create client
    const { createClient } = await import('./lib/supabase/client.js');
    const sb = createClient();
    
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://servio-production.up.railway.app'}/auth/callback`;
    
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true // Don't actually redirect, just test URL generation
      },
    });
    
    if (error) {
      console.log('✗ OAuth URL generation failed:', error.message);
    } else if (data?.url) {
      console.log('✓ OAuth URL generated successfully');
      console.log('OAuth URL (first 100 chars):', data.url.substring(0, 100));
    } else {
      console.log('✗ No OAuth URL received');
    }
  } catch (err) {
    console.log('✗ Error testing OAuth URL generation:', err.message);
  }
}

// Run the OAuth test
testOAuthUrl();

console.log('🔧 === AUTH FLOW TEST COMPLETE ===');
console.log('Check the console above for test results');

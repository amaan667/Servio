// Mobile Authentication Debug Script
// Run this in the browser console on mobile to debug auth issues

console.log('🔧 === MOBILE AUTH DEBUG SCRIPT ===');

// Test 1: Environment Check
console.log('Test 1: Environment Variables');
console.log({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://servio-production.up.railway.app',
  NODE_ENV: process.env.NODE_ENV
});

// Test 2: Mobile Detection
console.log('Test 2: Mobile Detection');
const userAgent = navigator.userAgent.toLowerCase();
const mobileKeywords = [
  'android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 
  'iemobile', 'opera mini', 'mobile', 'tablet'
];
const isMobile = mobileKeywords.some(keyword => userAgent.includes(keyword)) || window.innerWidth <= 768;

console.log({
  userAgent: navigator.userAgent,
  isMobile: isMobile,
  screenWidth: window.innerWidth,
  screenHeight: window.innerHeight,
  platform: navigator.platform,
  cookieEnabled: navigator.cookieEnabled,
  onLine: navigator.onLine
});

// Test 3: Storage State
console.log('Test 3: Storage State');
const authKeys = Object.keys(localStorage).filter(k => 
  k.includes('auth') || k.includes('sb-') || k.includes('pkce') || k.includes('supabase')
);
const sessionAuthKeys = Object.keys(sessionStorage).filter(k => 
  k.includes('auth') || k.includes('sb-') || k.includes('pkce') || k.includes('supabase')
);

console.log({
  localStorageKeys: Object.keys(localStorage).length,
  authKeys: authKeys,
  sessionStorageKeys: Object.keys(sessionStorage).length,
  sessionAuthKeys: sessionAuthKeys
});

// Test 4: Cookie State
console.log('Test 4: Cookie State');
const cookies = document.cookie.split(';').map(c => c.trim());
const authCookies = cookies.filter(c => c.startsWith('sb-') || c.includes('auth'));
console.log({
  totalCookies: cookies.length,
  authCookies: authCookies
});

// Test 5: Network Connectivity
console.log('Test 5: Network Connectivity');
console.log({
  onLine: navigator.onLine,
  connectionType: navigator.connection ? navigator.connection.effectiveType : 'unknown',
  downlink: navigator.connection ? navigator.connection.downlink : 'unknown'
});

// Test 6: Current URL Analysis
console.log('Test 6: Current URL Analysis');
const url = new URL(window.location.href);
console.log({
  href: window.location.href,
  origin: window.location.origin,
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
  hasCode: url.searchParams.has('code'),
  hasError: url.searchParams.has('error'),
  hasState: url.searchParams.has('state')
});

// Test 7: Supabase Client Test
console.log('Test 7: Supabase Client Test');
async function testSupabaseClient() {
  try {
    // Try to import and create client
    const { createClient } = await import('./lib/supabase/client.js');
    const sb = createClient();
    
    console.log('✓ Supabase client created successfully');
    
    // Test session check
    const { data: { session }, error } = await sb.auth.getSession();
    console.log('Session check result:', {
      hasSession: !!session,
      error: error?.message,
      userId: session?.user?.id
    });
    
    return true;
  } catch (err) {
    console.log('✗ Supabase client test failed:', err.message);
    return false;
  }
}

// Test 8: OAuth URL Generation Test
console.log('Test 8: OAuth URL Generation Test');
async function testOAuthUrl() {
  try {
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
      return false;
    } else if (data?.url) {
      console.log('✓ OAuth URL generated successfully');
      console.log('OAuth URL (first 100 chars):', data.url.substring(0, 100));
      return true;
    } else {
      console.log('✗ No OAuth URL received');
      return false;
    }
  } catch (err) {
    console.log('✗ Error testing OAuth URL generation:', err.message);
    return false;
  }
}

// Run the tests
async function runAllTests() {
  console.log('Running all tests...');
  
  const supabaseTest = await testSupabaseClient();
  const oauthTest = await testOAuthUrl();
  
  console.log('Test Results Summary:');
  console.log({
    environment: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ OK' : '✗ Missing vars',
    mobile: isMobile ? '✓ Mobile detected' : '✗ Desktop detected',
    storage: authKeys.length === 0 ? '✓ Clean' : `⚠ ${authKeys.length} auth keys found`,
    cookies: authCookies.length === 0 ? '✓ Clean' : `⚠ ${authCookies.length} auth cookies found`,
    network: navigator.onLine ? '✓ Online' : '✗ Offline',
    supabase: supabaseTest ? '✓ Working' : '✗ Failed',
    oauth: oauthTest ? '✓ Working' : '✗ Failed'
  });
  
  console.log('🔧 === MOBILE AUTH DEBUG COMPLETE ===');
}

// Run tests when script is loaded
runAllTests();
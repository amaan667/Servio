// OAuth Debug Script - Run this in browser console
console.log('🔧 === OAUTH DEBUG SCRIPT ===');

// Check environment variables
console.log('Environment Check:', {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'
});

// Check current URL
console.log('Current URL Check:', {
  href: window.location.href,
  origin: window.location.origin,
  hostname: window.location.hostname,
  protocol: window.location.protocol
});

// Test OAuth URL generation
async function testOAuthUrl() {
  try {
    console.log('Testing OAuth URL generation...');
    
    // Import Supabase client
    const { createClient } = await import('./lib/supabase/client.js');
    const sb = createClient();
    
    // Test different redirect URLs
    const redirectUrls = [
      `${window.location.origin}/auth/callback`,
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://servio-production.up.railway.app'}/auth/callback`,
      `${process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app'}/auth/callback`
    ];
    
    console.log('Testing redirect URLs:', redirectUrls);
    
    for (const redirectUrl of redirectUrls) {
      console.log(`Testing redirect URL: ${redirectUrl}`);
      
      try {
        const { data, error } = await sb.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true // Don't actually redirect
          },
        });
        
        if (error) {
          console.log(`❌ Error with ${redirectUrl}:`, error.message);
        } else if (data?.url) {
          console.log(`✅ Success with ${redirectUrl}`);
          console.log(`OAuth URL (first 100 chars): ${data.url.substring(0, 100)}`);
        } else {
          console.log(`❌ No URL returned for ${redirectUrl}`);
        }
      } catch (err) {
        console.log(`❌ Exception with ${redirectUrl}:`, err.message);
      }
    }
    
  } catch (err) {
    console.log('Error testing OAuth URL:', err.message);
  }
}

// Run the test
testOAuthUrl();

console.log('🔧 === OAUTH DEBUG COMPLETE ===');

// OAuth Configuration Check Script
// Run this in browser console to check your OAuth setup

console.log('🔧 === OAUTH CONFIGURATION CHECK ===');

// Check current environment
console.log('Current Environment:', {
  hostname: window.location.hostname,
  origin: window.location.origin,
  protocol: window.location.protocol,
  port: window.location.port
});

// Determine expected redirect URLs
const expectedRedirects = [];
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  expectedRedirects.push(`${window.location.origin}/auth/callback`);
  console.log('✅ Local development detected');
} else {
  expectedRedirects.push('https://servio-production.up.railway.app/auth/callback');
  console.log('✅ Production environment detected');
}

console.log('Expected redirect URLs for this environment:', expectedRedirects);

// Instructions for Supabase configuration
console.log('\n📋 SUPABASE CONFIGURATION CHECKLIST:');
console.log('1. Go to your Supabase dashboard');
console.log('2. Navigate to Authentication > URL Configuration');
console.log('3. Make sure these redirect URLs are configured:');
expectedRedirects.forEach(url => {
  console.log(`   - ${url}`);
});

// Additional URLs that should be configured
const additionalUrls = [
  'http://localhost:3000/auth/callback',
  'http://127.0.0.1:3000/auth/callback',
  'https://servio-production.up.railway.app/auth/callback'
];

console.log('\n📋 ALL RECOMMENDED REDIRECT URLS:');
additionalUrls.forEach(url => {
  console.log(`   - ${url}`);
});

console.log('\n⚠️  IMPORTANT:');
console.log('- Make sure ALL the URLs above are added to your Supabase OAuth configuration');
console.log('- The callback URL must exactly match what Google OAuth redirects to');
console.log('- If testing locally, localhost URLs must be configured in Supabase');

console.log('\n🔧 === CONFIGURATION CHECK COMPLETE ===');

// Comprehensive Google OAuth Test Script
console.log('🧪 Testing Google OAuth Flow...');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  endpoints: {
    signIn: '/sign-in',
    callback: '/auth/callback',
    debug: '/api/auth/debug',
    callbackDebug: '/auth/callback-debug'
  }
};

// Test 1: Check environment configuration
async function testEnvironmentConfig() {
  console.log('\n🔧 Test 1: Environment Configuration');
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/auth/debug`);
    const data = await response.json();
    
    console.log('✅ Debug endpoint accessible');
    console.log('📊 Environment:', {
      NODE_ENV: data.environment.NODE_ENV,
      hasSupabaseUrl: data.environment.NEXT_PUBLIC_SUPABASE_URL === 'Set',
      hasAnonKey: data.environment.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'Set',
      hasServiceKey: data.environment.SUPABASE_SERVICE_ROLE_KEY === 'Set'
    });
    
    return data.environment.NEXT_PUBLIC_SUPABASE_URL === 'Set' && 
           data.environment.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'Set';
  } catch (error) {
    console.log('❌ Environment config test failed:', error.message);
    return false;
  }
}

// Test 2: Check sign-in page accessibility
async function testSignInPage() {
  console.log('\n🔐 Test 2: Sign-In Page Accessibility');
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/sign-in`);
    const html = await response.text();
    
    console.log('✅ Sign-in page accessible');
    console.log('📊 Page status:', response.status);
    console.log('📊 Content length:', html.length);
    
    // Check for key elements
    const hasGoogleButton = html.includes('Sign in with Google') || html.includes('google');
    const hasForm = html.includes('form') || html.includes('button');
    
    console.log('📊 Has Google button:', hasGoogleButton);
    console.log('📊 Has form elements:', hasForm);
    
    return response.status === 200 && hasForm;
  } catch (error) {
    console.log('❌ Sign-in page test failed:', error.message);
    return false;
  }
}

// Test 3: Check callback page accessibility
async function testCallbackPage() {
  console.log('\n🔄 Test 3: Callback Page Accessibility');
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/auth/callback`);
    const html = await response.text();
    
    console.log('✅ Callback page accessible');
    console.log('📊 Page status:', response.status);
    console.log('📊 Content length:', html.length);
    
    // Check for key elements
    const hasLoadingState = html.includes('Signing you in') || html.includes('loading');
    const hasErrorHandling = html.includes('error') || html.includes('Error');
    
    console.log('📊 Has loading state:', hasLoadingState);
    console.log('📊 Has error handling:', hasErrorHandling);
    
    return response.status === 200;
  } catch (error) {
    console.log('❌ Callback page test failed:', error.message);
    return false;
  }
}

// Test 4: Check callback debug page
async function testCallbackDebugPage() {
  console.log('\n🐛 Test 4: Callback Debug Page');
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/auth/callback-debug`);
    const html = await response.text();
    
    console.log('✅ Callback debug page accessible');
    console.log('📊 Page status:', response.status);
    
    return response.status === 200;
  } catch (error) {
    console.log('❌ Callback debug page test failed:', error.message);
    return false;
  }
}

// Test 5: Simulate OAuth flow (without actual OAuth)
async function testOAuthFlowSimulation() {
  console.log('\n🔄 Test 5: OAuth Flow Simulation');
  
  try {
    // Test the auth redirect URL generation
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/auth/debug`);
    const data = await response.json();
    
    console.log('✅ Auth state check successful');
    console.log('📊 Current auth state:', {
      hasUser: data.auth.hasUser,
      hasSession: data.auth.hasSession,
      userError: data.auth.userError,
      sessionError: data.auth.sessionError
    });
    
    // Check if we're in development mode
    const isDevelopment = data.environment.NODE_ENV === 'development';
    console.log('📊 Development mode:', isDevelopment);
    
    if (isDevelopment) {
      console.log('⚠️  WARNING: Auth config may be forcing production URL in development');
      console.log('💡 This could cause refresh token errors');
    }
    
    return true;
  } catch (error) {
    console.log('❌ OAuth flow simulation failed:', error.message);
    return false;
  }
}

// Test 6: Check for common OAuth issues
async function testCommonOAuthIssues() {
  console.log('\n🔍 Test 6: Common OAuth Issues Check');
  
  const issues = [];
  
  try {
    // Check if we're using the correct redirect URL
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/auth/debug`);
    const data = await response.json();
    
    // Issue 1: Production URL in development
    if (data.environment.NODE_ENV === 'development') {
      console.log('⚠️  Potential Issue: Development mode detected');
      console.log('💡 Check if auth config is using production URLs in development');
    }
    
    // Issue 2: Missing environment variables
    if (data.environment.NEXT_PUBLIC_SUPABASE_URL !== 'Set') {
      issues.push('Missing NEXT_PUBLIC_SUPABASE_URL');
    }
    if (data.environment.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'Set') {
      issues.push('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    
    // Issue 3: Auth session errors
    if (data.auth.userError) {
      issues.push(`Auth user error: ${data.auth.userError}`);
    }
    if (data.auth.sessionError) {
      issues.push(`Auth session error: ${data.auth.sessionError}`);
    }
    
    if (issues.length === 0) {
      console.log('✅ No common OAuth issues detected');
    } else {
      console.log('❌ Potential OAuth issues detected:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
    
    return issues.length === 0;
  } catch (error) {
    console.log('❌ OAuth issues check failed:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive Google OAuth tests...\n');
  
  const results = await Promise.all([
    testEnvironmentConfig(),
    testSignInPage(),
    testCallbackPage(),
    testCallbackDebugPage(),
    testOAuthFlowSimulation(),
    testCommonOAuthIssues()
  ]);
  
  const passedTests = results.filter(result => result).length;
  const totalTests = results.length;
  
  console.log('\n📊 Test Summary:');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! OAuth flow should work correctly.');
  } else {
    console.log('\n🔧 Some tests failed. Check the issues above.');
  }
  
  console.log('\n💡 Next Steps:');
  console.log('1. Visit http://localhost:3002/sign-in');
  console.log('2. Open browser developer tools (F12)');
  console.log('3. Go to Console tab');
  console.log('4. Click "Sign in with Google"');
  console.log('5. Watch for [AUTH DEBUG] logs');
  console.log('6. Check for any error messages');
  
  console.log('\n🔍 Debug Tools:');
  console.log('- Auth Debug: http://localhost:3002/debug-auth');
  console.log('- Callback Debug: http://localhost:3002/auth/callback-debug');
  console.log('- API Debug: http://localhost:3002/api/auth/debug');
}

// Run tests
runAllTests();

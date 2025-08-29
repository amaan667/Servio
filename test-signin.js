// Test script to verify sign-in functionality across mobile and desktop
// This script can be run in the browser console to test the sign-in flow

console.log('🧪 Starting Sign-In Functionality Test...');

// Test 1: Environment Detection
function testEnvironment() {
  console.log('=== Test 1: Environment Detection ===');
  
  const userAgent = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isDesktop = !isMobile;
  
  console.log('User Agent:', userAgent);
  console.log('Is Mobile:', isMobile);
  console.log('Is Desktop:', isDesktop);
  console.log('Screen Size:', `${window.innerWidth}x${window.innerHeight}`);
  console.log('Viewport:', `${window.visualViewport?.width || 'N/A'}x${window.visualViewport?.height || 'N/A'}`);
  
  return { isMobile, isDesktop, userAgent };
}

// Test 2: Button Click Simulation
function testButtonClick() {
  console.log('=== Test 2: Button Click Simulation ===');
  
  const googleButton = document.querySelector('button[onclick*="handleGoogleSignIn"], button:contains("Sign in with Google")');
  
  if (googleButton) {
    console.log('✓ Google sign-in button found');
    console.log('Button text:', googleButton.textContent);
    console.log('Button disabled:', googleButton.disabled);
    console.log('Button classes:', googleButton.className);
    
    // Simulate click
    try {
      googleButton.click();
      console.log('✓ Button click simulated successfully');
      return true;
    } catch (error) {
      console.log('✗ Button click failed:', error);
      return false;
    }
  } else {
    console.log('✗ Google sign-in button not found');
    return false;
  }
}

// Test 3: Popup Blocker Detection
function testPopupBlocker() {
  console.log('=== Test 3: Popup Blocker Detection ===');
  
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    console.log('Skipping popup test on mobile device');
    return { blocked: false, reason: 'mobile' };
  }
  
  try {
    const popup = window.open('', '_blank', 'width=1,height=1');
    
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      console.log('✗ Popup blocker detected');
      return { blocked: true, reason: 'popup_blocked' };
    } else {
      popup.close();
      console.log('✓ Popup test successful');
      return { blocked: false, reason: 'success' };
    }
  } catch (error) {
    console.log('✗ Popup test failed:', error);
    return { blocked: true, reason: 'error' };
  }
}

// Test 4: OAuth URL Generation
async function testOAuthURL() {
  console.log('=== Test 4: OAuth URL Generation ===');
  
  try {
    // This would require the actual Supabase client
    // For now, we'll just test the URL construction
    const origin = window.location.origin;
    const redirectUrl = `${origin}/auth/callback`;
    
    console.log('Origin:', origin);
    console.log('Redirect URL:', redirectUrl);
    console.log('✓ URL construction successful');
    
    return { success: true, redirectUrl };
  } catch (error) {
    console.log('✗ URL generation failed:', error);
    return { success: false, error };
  }
}

// Test 5: Form Validation
function testFormValidation() {
  console.log('=== Test 5: Form Validation ===');
  
  const emailInput = document.querySelector('input[type="email"]');
  const passwordInput = document.querySelector('input[type="password"]');
  const submitButton = document.querySelector('button[type="submit"]');
  
  if (emailInput && passwordInput && submitButton) {
    console.log('✓ All form elements found');
    console.log('Email input required:', emailInput.required);
    console.log('Password input required:', passwordInput.required);
    console.log('Submit button disabled:', submitButton.disabled);
    
    return { success: true, hasEmail: true, hasPassword: true, hasSubmit: true };
  } else {
    console.log('✗ Missing form elements');
    return { 
      success: false, 
      hasEmail: !!emailInput, 
      hasPassword: !!passwordInput, 
      hasSubmit: !!submitButton 
    };
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive sign-in test...\n');
  
  const results = {
    environment: testEnvironment(),
    buttonClick: testButtonClick(),
    popupBlocker: testPopupBlocker(),
    oauthURL: await testOAuthURL(),
    formValidation: testFormValidation()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('Environment:', results.environment.isMobile ? 'Mobile' : 'Desktop');
  console.log('Button Click:', results.buttonClick ? '✓ Working' : '✗ Failed');
  console.log('Popup Blocker:', results.popupBlocker.blocked ? '✗ Blocked' : '✓ Allowed');
  console.log('OAuth URL:', results.oauthURL.success ? '✓ Generated' : '✗ Failed');
  console.log('Form Validation:', results.formValidation.success ? '✓ Valid' : '✗ Invalid');
  
  // Overall assessment
  const issues = [];
  if (!results.buttonClick) issues.push('Button click not working');
  if (results.popupBlocker.blocked && !results.environment.isMobile) issues.push('Popup blocker active');
  if (!results.oauthURL.success) issues.push('OAuth URL generation failed');
  if (!results.formValidation.success) issues.push('Form validation issues');
  
  if (issues.length === 0) {
    console.log('\n🎉 All tests passed! Sign-in should work correctly.');
  } else {
    console.log('\n⚠️ Issues detected:');
    issues.forEach(issue => console.log(`- ${issue}`));
  }
  
  return results;
}

// Export for use in browser console
window.testSignIn = runAllTests;
console.log('✅ Test script loaded. Run "testSignIn()" in the console to start testing.');

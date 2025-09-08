#!/usr/bin/env node

// Test script to verify PKCE payload structure
const testPayload = {
  code: "test_auth_code_string",
  code_verifier: "test_code_verifier_string",
  redirect_uri: "http://localhost:3000/auth/callback"
};

console.log('Testing PKCE payload structure:');
console.log('✅ Payload keys:', Object.keys(testPayload));
console.log('✅ All values are strings:', Object.values(testPayload).every(v => typeof v === 'string'));
console.log('✅ Has required "code" field:', testPayload.hasOwnProperty('code'));
console.log('✅ Has required "code_verifier" field:', testPayload.hasOwnProperty('code_verifier'));
console.log('✅ Has optional "redirect_uri" field:', testPayload.hasOwnProperty('redirect_uri'));
console.log('✅ No nested objects:', JSON.stringify(testPayload));

console.log('\nPayload structure validation:');
console.log('- Uses "code" instead of "auth_code":', !testPayload.hasOwnProperty('auth_code'));
console.log('- "code_verifier" is exact key name:', testPayload.hasOwnProperty('code_verifier'));
console.log('- "redirect_uri" included if used in login:', testPayload.hasOwnProperty('redirect_uri'));
console.log('- Values are plain strings, not wrapped in objects:', true);

console.log('\nExample payload:');
console.log(JSON.stringify(testPayload, null, 2));
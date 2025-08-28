#!/usr/bin/env node

/**
 * Test script to verify PKCE implementation
 * This script tests the OAuth flow setup without actually redirecting
 */

const { createClient } = require('@supabase/supabase-js');

// Mock environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

async function testPKCEImplementation() {
  console.log('🧪 Testing PKCE Implementation...\n');

  try {
    // Create Supabase client with PKCE configuration
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          flowType: 'pkce',
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        }
      }
    );

    console.log('✅ Supabase client created with PKCE configuration');

    // Test OAuth URL generation (this won't actually redirect)
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        flowType: 'pkce',
        redirectTo: 'http://localhost:3000/auth/callback',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('❌ OAuth URL generation failed:', error.message);
      return false;
    }

    if (!data?.url) {
      console.error('❌ No OAuth URL received');
      return false;
    }

    console.log('✅ OAuth URL generated successfully');
    console.log('📝 URL length:', data.url.length);
    console.log('🔗 URL preview:', data.url.substring(0, 100) + '...');

    // Check if URL contains PKCE parameters
    const url = new URL(data.url);
    const hasCodeChallenge = url.searchParams.has('code_challenge');
    const hasCodeChallengeMethod = url.searchParams.has('code_challenge_method');
    const hasState = url.searchParams.has('state');

    console.log('\n📊 PKCE Parameters Check:');
    console.log('  - code_challenge:', hasCodeChallenge ? '✅' : '❌');
    console.log('  - code_challenge_method:', hasCodeChallengeMethod ? '✅' : '❌');
    console.log('  - state:', hasState ? '✅' : '❌');

    if (hasCodeChallenge && hasCodeChallengeMethod && hasState) {
      console.log('\n🎉 PKCE implementation appears to be working correctly!');
      return true;
    } else {
      console.log('\n⚠️  Some PKCE parameters are missing');
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testPKCEImplementation()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { testPKCEImplementation };
#!/usr/bin/env node

// Simple script to check environment variables
console.log('🔧 Environment Variable Check');
console.log('============================');

const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'APP_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL'
];

const optionalVars = [
  'NODE_ENV',
  'IS_PRODUCTION'
];

console.log('\n📋 Required Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${varName}: MISSING`);
  }
});

console.log('\n📋 Optional Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value}`);
  } else {
    console.log(`⚠️  ${varName}: Not set`);
  }
});

console.log('\n🔍 Environment Analysis:');
console.log(`Node.js Version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);
console.log(`Current Directory: ${process.cwd()}`);

// Check for common issues
console.log('\n🚨 Potential Issues:');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.log('❌ Missing Supabase URL - Dashboard will crash');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.log('❌ Missing Supabase Anon Key - Dashboard will crash');
}

if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://')) {
  console.log('⚠️  Supabase URL should use HTTPS');
}

if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length < 100) {
  console.log('⚠️  Supabase Anon Key seems too short');
}

console.log('\n✅ Check complete!');
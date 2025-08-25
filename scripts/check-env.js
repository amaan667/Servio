#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Servio environment configuration...\n');

<<<<<<< HEAD
// [FIX] Writing file to .env.local in project root
console.log('📝 [FIX] Writing file to .env.local in project root');

// Check for .env.local file
const envLocalPath = path.join(process.cwd(), '.env.local');
const envLocalExists = fs.existsSync(envLocalPath);

console.log('📁 Environment files:');
console.log(`   .env.local: ${envLocalExists ? '✅ Found' : '❌ Not found'}`);

// Check environment variables
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

console.log('\n🔑 Required environment variables:');

let allConfigured = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  const isSet = !!value;
  const status = isSet ? '✅ Set' : '❌ Missing';
  const preview = isSet ? `${value.substring(0, 20)}...` : '';
  
  console.log(`   ${varName}: ${status} ${preview}`);
  
  if (!isSet) {
    allConfigured = false;
  }
});

// Check optional variables
const optionalVars = [
  'NEXT_PUBLIC_SITE_URL',
  'GOOGLE_CREDENTIALS_B64',
  'GCS_BUCKET_NAME',
  'OPENAI_API_KEY'
];

console.log('\n🔧 Optional environment variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  const isSet = !!value;
  const status = isSet ? '✅ Set' : '⚪ Not set';
  const preview = isSet ? `${value.substring(0, 20)}...` : '';
  
  console.log(`   ${varName}: ${status} ${preview}`);
});

console.log('\n📋 Summary:');
if (allConfigured) {
  console.log('✅ All required environment variables are configured!');
  console.log('   Your application should be able to authenticate users.');
} else {
  console.log('❌ Some required environment variables are missing.');
  console.log('\n🔧 To fix this:');
  console.log('   1. Create a .env.local file in your project root');
  console.log('   2. Add the missing environment variables:');
  console.log('      NEXT_PUBLIC_SUPABASE_URL=your_supabase_url');
  console.log('      NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key');
  console.log('   3. Restart your development server');
  console.log('\n📚 For more help, see TROUBLESHOOTING.md');
}

// Helper function to safely write environment file
function createEnvFile() {
  try {
<<<<<<< HEAD
    const envLocalPath = path.join(process.cwd(), '.env.local');
    const envExamplePath = path.join(process.cwd(), '.env.local.example');
    
    // Ensure parent directory exists
    const envDir = path.dirname(envLocalPath);
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true });
      console.log('📁 Created directory:', envDir);
    }
    
    // Copy from example if it exists
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envLocalPath);
<<<<<<< HEAD
      console.log('✅ Created .env.local from .env.local.example');
      return true;
    } else {
      console.log('❌ .env.local.example not found');
      return false;
    }
  } catch (error) {
    console.error('❌ Error creating .env.local:', error.message);
    return false;
  }
}

console.log('\n🚀 Next steps:');
if (allConfigured) {
  console.log('   - Run "npm run dev" to start the development server');
  console.log('   - Visit https://servio-production.up.railway.app to test the application');
} else {
  console.log('   - Configure the missing environment variables');
  console.log('   - Then run "npm run dev" to start the development server');
}
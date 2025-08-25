#!/usr/bin/env node

console.log('🚂 Railway Environment Check');
console.log('============================');

// Check if we're running on Railway
const isRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
console.log(`🔍 Running on Railway: ${isRailway ? 'YES' : 'NO'}`);

if (isRailway) {
  console.log(`📍 Railway Environment: ${process.env.RAILWAY_ENVIRONMENT || 'unknown'}`);
  console.log(`📂 Railway Project: ${process.env.RAILWAY_PROJECT_ID || 'unknown'}`);
}

console.log(`📁 Working Directory: ${process.cwd()}`);
console.log(`🏗️  Node Environment: ${process.env.NODE_ENV || 'not set'}`);


// Check required environment variables
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_URL'
];

console.log('\n🔑 Environment Variables Check:');
console.log('================================');

let allGood = true;
requiredVars.forEach(varName => {
  const value = process.env[varName];
  const isSet = !!value;
  const status = isSet ? '✅' : '❌';
  const preview = isSet ? `${value.substring(0, 30)}...` : 'NOT SET';
  
  console.log(`${status} ${varName}: ${preview}`);
  
  if (!isSet) {
    allGood = false;
  }
});

// Check app directory exists
const fs = require('fs');
const path = require('path');

console.log('\n📂 Directory Structure Check:');
console.log('==============================');

const appDirPath = path.join(process.cwd(), 'src', 'app');
const appDirExists = fs.existsSync(appDirPath);
const appDirIsDir = appDirExists && fs.statSync(appDirPath).isDirectory();

console.log(`📁 src/app/ directory exists: ${appDirExists ? '✅' : '❌'}`);
console.log(`📁 src/app/ is directory: ${appDirIsDir ? '✅' : '❌'}`);

if (appDirExists) {
  try {
    const appContents = fs.readdirSync(appDirPath);
    console.log(`📋 src/app/ contents: ${appContents.slice(0, 5).join(', ')}${appContents.length > 5 ? '...' : ''}`);
  } catch (error) {
    console.log(`❌ Cannot read src/app/ directory: ${error.message}`);
  }
}

// Check for conflicting files
const conflictFiles = ['app', 'App', 'APP'];
conflictFiles.forEach(fileName => {
  const filePath = path.join(process.cwd(), fileName);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const type = stats.isDirectory() ? 'directory' : 'file';
    console.log(`⚠️  WARNING: Found ${type} named '${fileName}' at root level`);
    if (stats.isDirectory()) {
      try {
        const contents = fs.readdirSync(filePath);
        console.log(`   Contents: ${contents.slice(0, 5).join(', ')}${contents.length > 5 ? '...' : ''}`);
      } catch (error) {
        console.log(`   Cannot read contents: ${error.message}`);
      }
    }
  }
});

console.log('\n📊 Summary:');
console.log('===========');

if (allGood && appDirIsDir) {
  console.log('✅ All checks passed! Environment should be ready for build.');
} else {
  console.log('❌ Issues detected:');
  if (!allGood) {
    console.log('   - Missing required environment variables');
  }
  if (!appDirIsDir) {
    console.log('   - src/app/ directory issue detected');
  }
}

console.log('\n🔧 Next Steps:');
if (!allGood) {
  console.log('   1. Set missing environment variables in Railway dashboard');
  console.log('   2. Redeploy the application');
}
if (!appDirIsDir) {
  console.log('   1. Check for files conflicting with src/app/ directory');
console.log('   2. Ensure src/app/ directory structure is correct');
}

console.log('\n📞 Support:');
console.log('   - Check Railway logs for detailed error messages');
console.log('   - Verify environment variables in Railway dashboard');
console.log('   - Ensure latest code is deployed');
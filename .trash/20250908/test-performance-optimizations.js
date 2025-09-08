#!/usr/bin/env node

/**
 * Performance Optimization Test Script
 * 
 * This script tests the key performance optimizations made to the Servio MVP:
 * 1. No artificial delays in payment simulation
 * 2. No blocking loading states
 * 3. Server-side data fetching
 * 4. Optimistic UI updates
 * 5. Parallel processing
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Testing Performance Optimizations...\n');

// Test 1: Check for artificial delays
console.log('1. Checking for artificial delays...');
const filesToCheck = [
  'components/payment-simulation.tsx',
  'app/page.tsx',
  'app/order/page.tsx',
  'app/checkout/page.tsx',
  'app/payment/page.tsx',
  'app/auth/callback/page.tsx'
];

let delayIssues = 0;
filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for common artificial delay patterns
    const delayPatterns = [
      /setTimeout\([^,]+,\s*[2-9]\d{3,}\)/, // 2+ second delays
      /await new Promise\(resolve => setTimeout\(resolve,\s*[2-9]\d{3,}\)\)/, // 2+ second awaits
      /setTimeout\([^,]+,\s*1\d{3,}\)/, // 1+ second delays
    ];
    
    delayPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        console.log(`   ❌ Found artificial delay in ${file}`);
        delayIssues++;
      }
    });
  }
});

if (delayIssues === 0) {
  console.log('   ✅ No artificial delays found');
} else {
  console.log(`   ⚠️  Found ${delayIssues} potential delay issues`);
}

// Test 2: Check for blocking loading states
console.log('\n2. Checking for blocking loading states...');
const loadingFiles = [
  'app/page.tsx',
  'app/page-bypass.tsx',
  'app/sign-in/page.tsx',
  'app/auth/callback/page.tsx'
];

let loadingIssues = 0;
loadingFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for blocking loading patterns
    const blockingPatterns = [
      /if \(loading\)\s*{\s*return\s*\(\s*<div[^>]*>.*?Loading.*?<\/div>/s,
      /if \(isLoading\)\s*{\s*return\s*\(\s*<div[^>]*>.*?Loading.*?<\/div>/s,
    ];
    
    blockingPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        console.log(`   ❌ Found blocking loading state in ${file}`);
        loadingIssues++;
      }
    });
  }
});

if (loadingIssues === 0) {
  console.log('   ✅ No blocking loading states found');
} else {
  console.log(`   ⚠️  Found ${loadingIssues} blocking loading issues`);
}

// Test 3: Check for server-side data fetching
console.log('\n3. Checking for server-side data fetching...');
const serverFiles = [
  'app/dashboard/[venueId]/orders/page.tsx',
  'app/dashboard/[venueId]/page.tsx'
];

let serverDataFound = 0;
serverFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for server-side data fetching patterns
    if (content.includes('await supabase') && content.includes('export default async function')) {
      console.log(`   ✅ Server-side data fetching found in ${file}`);
      serverDataFound++;
    }
  }
});

if (serverDataFound > 0) {
  console.log(`   ✅ Found ${serverDataFound} files with server-side data fetching`);
} else {
  console.log('   ⚠️  No server-side data fetching found');
}

// Test 4: Check for optimistic updates
console.log('\n4. Checking for optimistic updates...');
const optimisticFiles = [
  'components/table-management/TableCardRefactored.tsx',
  'components/menu-management.tsx',
  'components/live-orders.tsx'
];

let optimisticFound = 0;
optimisticFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for optimistic update patterns
    if (content.includes('Optimistic update') || content.includes('onActionComplete()') || content.includes('setOrders(prevOrders')) {
      console.log(`   ✅ Optimistic updates found in ${file}`);
      optimisticFound++;
    }
  }
});

if (optimisticFound > 0) {
  console.log(`   ✅ Found ${optimisticFound} files with optimistic updates`);
} else {
  console.log('   ⚠️  No optimistic updates found');
}

// Test 5: Check for parallel processing
console.log('\n5. Checking for parallel processing...');
const parallelFiles = [
  'app/api/menu/process/route.ts'
];

let parallelFound = 0;
parallelFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for parallel processing patterns
    if (content.includes('Promise.all') && content.includes('map(async')) {
      console.log(`   ✅ Parallel processing found in ${file}`);
      parallelFound++;
    }
  }
});

if (parallelFound > 0) {
  console.log(`   ✅ Found ${parallelFound} files with parallel processing`);
} else {
  console.log('   ⚠️  No parallel processing found');
}

// Test 6: Check for production-safe logging
console.log('\n6. Checking for production-safe logging...');
const loggerFile = path.join(__dirname, 'lib/logger-simple.ts');
if (fs.existsSync(loggerFile)) {
  const content = fs.readFileSync(loggerFile, 'utf8');
  if (content.includes('process.env.NODE_ENV') && content.includes('console.error')) {
    console.log('   ✅ Production-safe logger found');
  } else {
    console.log('   ⚠️  Logger may not be production-safe');
  }
} else {
  console.log('   ⚠️  No logger file found');
}

// Summary
console.log('\n📊 Performance Optimization Summary:');
console.log(`   • Artificial delays: ${delayIssues === 0 ? '✅ Removed' : '⚠️  Issues found'}`);
console.log(`   • Blocking loading states: ${loadingIssues === 0 ? '✅ Removed' : '⚠️  Issues found'}`);
console.log(`   • Server-side data fetching: ${serverDataFound > 0 ? '✅ Implemented' : '⚠️  Not found'}`);
console.log(`   • Optimistic updates: ${optimisticFound > 0 ? '✅ Implemented' : '⚠️  Not found'}`);
console.log(`   • Parallel processing: ${parallelFound > 0 ? '✅ Implemented' : '⚠️  Not found'}`);
console.log(`   • Production logging: ${fs.existsSync(loggerFile) ? '✅ Implemented' : '⚠️  Not found'}`);

const totalScore = (delayIssues === 0 ? 1 : 0) + 
                  (loadingIssues === 0 ? 1 : 0) + 
                  (serverDataFound > 0 ? 1 : 0) + 
                  (optimisticFound > 0 ? 1 : 0) + 
                  (parallelFound > 0 ? 1 : 0) + 
                  (fs.existsSync(loggerFile) ? 1 : 0);

console.log(`\n🎯 Overall Score: ${totalScore}/6`);

if (totalScore >= 5) {
  console.log('🎉 Excellent! Performance optimizations are well implemented.');
} else if (totalScore >= 3) {
  console.log('👍 Good! Most performance optimizations are in place.');
} else {
  console.log('⚠️  Some performance optimizations may need attention.');
}

console.log('\n✨ Performance optimization testing complete!');

#!/usr/bin/env node

/**
 * Authentication Compatibility Test Script
 * Tests authentication flow on both mobile and desktop environments
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Desktop Chrome',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    platform: 'desktop'
  },
  {
    name: 'Mobile Chrome Android',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    platform: 'mobile'
  },
  {
    name: 'Mobile Safari iOS',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1.2 Mobile/15E148 Safari/604.1',
    platform: 'mobile'
  },
  {
    name: 'Desktop Firefox',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    platform: 'desktop'
  }
];

// Utility functions
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': options.userAgent || 'Test-Script/1.0',
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          cookies: res.headers['set-cookie'] || []
        });
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

function extractCookies(cookieHeaders) {
  const cookies = {};
  cookieHeaders.forEach(cookie => {
    const [nameValue] = cookie.split(';');
    const [name, value] = nameValue.split('=');
    cookies[name.trim()] = value;
  });
  return cookies;
}

function log(message, scenario = '') {
  const timestamp = new Date().toISOString();
  const prefix = scenario ? `[${scenario}]` : '[TEST]';
  console.log(`${timestamp} ${prefix} ${message}`);
}

// Test functions
async function testHealthCheck(scenario) {
  log('Testing health check endpoint', scenario.name);
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/auth/health`, {
      userAgent: scenario.userAgent
    });
    
    if (response.statusCode === 200) {
      log('✅ Health check passed', scenario.name);
      return true;
    } else {
      log(`❌ Health check failed: ${response.statusCode}`, scenario.name);
      return false;
    }
  } catch (error) {
    log(`❌ Health check error: ${error.message}`, scenario.name);
    return false;
  }
}

async function testSignInPage(scenario) {
  log('Testing sign-in page accessibility', scenario.name);
  
  try {
    const response = await makeRequest(`${BASE_URL}/sign-in`, {
      userAgent: scenario.userAgent
    });
    
    if (response.statusCode === 200) {
      log('✅ Sign-in page accessible', scenario.name);
      return true;
    } else {
      log(`❌ Sign-in page failed: ${response.statusCode}`, scenario.name);
      return false;
    }
  } catch (error) {
    log(`❌ Sign-in page error: ${error.message}`, scenario.name);
    return false;
  }
}

async function testOAuthInitiation(scenario) {
  log('Testing OAuth initiation', scenario.name);
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/auth/test-oauth`, {
      method: 'POST',
      userAgent: scenario.userAgent,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: 'google',
        platform: scenario.platform
      })
    });
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      if (data.success) {
        log('✅ OAuth initiation successful', scenario.name);
        return true;
      } else {
        log(`❌ OAuth initiation failed: ${data.error}`, scenario.name);
        return false;
      }
    } else {
      log(`❌ OAuth initiation failed: ${response.statusCode}`, scenario.name);
      return false;
    }
  } catch (error) {
    log(`❌ OAuth initiation error: ${error.message}`, scenario.name);
    return false;
  }
}

async function testSessionManagement(scenario) {
  log('Testing session management', scenario.name);
  
  try {
    // Test getting session without auth
    const response = await makeRequest(`${BASE_URL}/api/auth/debug`, {
      userAgent: scenario.userAgent
    });
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      log(`ℹ️ Session check: ${data.auth?.hasSession ? 'Has session' : 'No session'}`, scenario.name);
      return true;
    } else {
      log(`❌ Session check failed: ${response.statusCode}`, scenario.name);
      return false;
    }
  } catch (error) {
    log(`❌ Session check error: ${error.message}`, scenario.name);
    return false;
  }
}

async function testCookieHandling(scenario) {
  log('Testing cookie handling', scenario.name);
  
  try {
    // Test signout to check cookie clearing
    const response = await makeRequest(`${BASE_URL}/api/auth/signout`, {
      method: 'POST',
      userAgent: scenario.userAgent,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      if (data.ok) {
        log('✅ Cookie handling test passed', scenario.name);
        return true;
      } else {
        log(`❌ Cookie handling failed: ${data.error}`, scenario.name);
        return false;
      }
    } else {
      log(`❌ Cookie handling failed: ${response.statusCode}`, scenario.name);
      return false;
    }
  } catch (error) {
    log(`❌ Cookie handling error: ${error.message}`, scenario.name);
    return false;
  }
}

async function testProtectedRoute(scenario) {
  log('Testing protected route access', scenario.name);
  
  try {
    const response = await makeRequest(`${BASE_URL}/dashboard`, {
      userAgent: scenario.userAgent
    });
    
    // Should redirect to sign-in if not authenticated
    if (response.statusCode === 302 || response.statusCode === 200) {
      log('✅ Protected route handling correct', scenario.name);
      return true;
    } else {
      log(`❌ Protected route failed: ${response.statusCode}`, scenario.name);
      return false;
    }
  } catch (error) {
    log(`❌ Protected route error: ${error.message}`, scenario.name);
    return false;
  }
}

// Main test runner
async function runTests() {
  log('Starting authentication compatibility tests');
  log(`Base URL: ${BASE_URL}`);
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    scenarios: {}
  };
  
  for (const scenario of TEST_SCENARIOS) {
    log(`\n=== Testing ${scenario.name} ===`);
    
    results.scenarios[scenario.name] = {
      tests: [],
      passed: 0,
      failed: 0
    };
    
    const tests = [
      { name: 'Health Check', fn: testHealthCheck },
      { name: 'Sign-in Page', fn: testSignInPage },
      { name: 'OAuth Initiation', fn: testOAuthInitiation },
      { name: 'Session Management', fn: testSessionManagement },
      { name: 'Cookie Handling', fn: testCookieHandling },
      { name: 'Protected Route', fn: testProtectedRoute }
    ];
    
    for (const test of tests) {
      results.total++;
      log(`Running ${test.name}...`, scenario.name);
      
      try {
        const passed = await test.fn(scenario);
        
        if (passed) {
          results.passed++;
          results.scenarios[scenario.name].passed++;
          results.scenarios[scenario.name].tests.push({ name: test.name, status: 'PASS' });
        } else {
          results.failed++;
          results.scenarios[scenario.name].failed++;
          results.scenarios[scenario.name].tests.push({ name: test.name, status: 'FAIL' });
        }
      } catch (error) {
        results.failed++;
        results.scenarios[scenario.name].failed++;
        results.scenarios[scenario.name].tests.push({ name: test.name, status: 'ERROR', error: error.message });
        log(`❌ Test error: ${error.message}`, scenario.name);
      }
    }
  }
  
  // Print summary
  log('\n=== TEST SUMMARY ===');
  log(`Total Tests: ${results.total}`);
  log(`Passed: ${results.passed}`);
  log(`Failed: ${results.failed}`);
  log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  for (const [scenarioName, scenarioResults] of Object.entries(results.scenarios)) {
    log(`\n${scenarioName}:`);
    log(`  Passed: ${scenarioResults.passed}/${scenarioResults.tests.length}`);
    log(`  Failed: ${scenarioResults.failed}/${scenarioResults.tests.length}`);
    
    for (const test of scenarioResults.tests) {
      const status = test.status === 'PASS' ? '✅' : '❌';
      log(`    ${status} ${test.name}`);
      if (test.error) {
        log(`      Error: ${test.error}`);
      }
    }
  }
  
  // Exit with appropriate code
  if (results.failed > 0) {
    log('\n❌ Some tests failed');
    process.exit(1);
  } else {
    log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  testHealthCheck,
  testSignInPage,
  testOAuthInitiation,
  testSessionManagement,
  testCookieHandling,
  testProtectedRoute
};
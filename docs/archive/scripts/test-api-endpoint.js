// Test the orders API endpoint directly
// Run this with: node test-api-endpoint.js

const https = require('https');

const testApiEndpoint = async () => {
  const venueId = 'venue-1e02af4d';
  const baseUrl = 'https://servio-production.up.railway.app';
  
  console.log('🔍 Testing Orders API Endpoints...\n');
  
  // Test different scopes
  const scopes = ['live', 'earlier', 'history'];
  
  for (const scope of scopes) {
    const url = `${baseUrl}/api/dashboard/orders/one?venueId=${venueId}&scope=${scope}`;
    
    console.log(`📡 Testing ${scope.toUpperCase()} orders:`);
    console.log(`   URL: ${url}`);
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
      console.log('');
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      console.log('');
    }
  }
  
  // Test the main orders endpoint
  console.log('📡 Testing main orders endpoint:');
  const mainUrl = `${baseUrl}/api/dashboard/orders?venueId=${venueId}&scope=live`;
  console.log(`   URL: ${mainUrl}`);
  
  try {
    const response = await fetch(mainUrl);
    const data = await response.json();
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
};

// Run the test
testApiEndpoint().catch(console.error);

// Test script to verify the API call is working correctly
// Run this in your browser console to test the API directly

async function testTableCreation() {
  try {
    console.log('Testing table creation API...');
    
    const response = await fetch('/api/tables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        venue_id: 'venue-1e02af4d',
        label: 'API Test Table',
        seat_count: 2,
        area: 'Test Area'
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (!response.ok) {
      console.error('API Error:', data);
    } else {
      console.log('✅ Table created successfully:', data.table);
    }
    
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

// Run the test
testTableCreation();

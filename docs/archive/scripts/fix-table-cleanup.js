// Script to manually clear table references and delete tables
const SUPABASE_URL = 'https://servio-production.up.railway.app';
const VENUE_ID = 'venue-1e02af4d';

async function fixTableCleanup() {
  try {
    console.log('🔧 Starting manual table cleanup...');
    
    // Step 1: Clear all table references from orders
    console.log('🔧 Step 1: Clearing table references from orders...');
    const clearRefsResponse = await fetch(`${SUPABASE_URL}/api/orders/clear-table-refs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ venueId: VENUE_ID }),
    });
    
    if (clearRefsResponse.ok) {
      console.log('✅ Table references cleared successfully');
    } else {
      console.log('⚠️ Clear table refs failed, trying direct approach...');
    }
    
    // Step 2: Delete all tables
    console.log('🔧 Step 2: Deleting all tables...');
    const deleteTablesResponse = await fetch(`${SUPABASE_URL}/api/tables/clear-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ venue_id: VENUE_ID }),
    });
    
    const result = await deleteTablesResponse.json();
    
    if (deleteTablesResponse.ok) {
      console.log('✅ All tables deleted successfully:', result);
    } else {
      console.error('❌ Failed to delete tables:', result);
    }
    
  } catch (error) {
    console.error('❌ Error in table cleanup:', error);
  }
}

fixTableCleanup();

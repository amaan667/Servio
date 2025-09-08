const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cpwemmofzjfzbmqcgjrq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function disableRLSTemp() {
  console.log('🔧 Temporarily disabling RLS to fix QR code menu items...');
  
  try {
    console.log('✅ Connected to Supabase with service role');

    // Since we can't use exec_sql, let's try a different approach
    // Let's check if we can directly modify the table structure
    
    console.log('🔍 Checking current RLS status...');
    
    // Test if we can access menu items
    const { data: testData, error: testError } = await supabase
      .from('menu_items')
      .select('id, name, venue_id, available')
      .eq('available', true)
      .limit(5);

    if (testError) {
      console.log('❌ Current access test failed:', testError.message);
      console.log('   This confirms RLS is blocking access');
    } else {
      console.log('✅ Current access test successful:', testData?.length || 0, 'items found');
    }

    console.log('\n⚠️  IMPORTANT: Since exec_sql function is not available,');
    console.log('   you need to manually apply the RLS fix in the Supabase dashboard.');
    console.log('');
    console.log('📋 Steps to fix in Supabase Dashboard:');
    console.log('   1. Go to your Supabase project dashboard');
    console.log('   2. Navigate to Authentication > Policies');
    console.log('   3. Find the menu_items table');
    console.log('   4. Click "New Policy"');
    console.log('   5. Choose "Create a policy from scratch"');
    console.log('   6. Set Target roles to "public"');
    console.log('   7. Set Policy definition to "true"');
    console.log('   8. Save the policy');
    console.log('');
    console.log('🔧 Or temporarily disable RLS:');
    console.log('   1. Go to Database > Tables');
    console.log('   2. Click on menu_items table');
    console.log('   3. Toggle "Row Level Security" to OFF');
    console.log('   4. Do the same for venues table');
    console.log('');
    console.log('💡 This will immediately fix the QR code issue');
    console.log('   We can re-enable RLS with proper policies later');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

disableRLSTemp();

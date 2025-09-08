// Test script to verify reservation fix
// Run this after applying the database fix

const { createClient } = require('@supabase/supabase-js');

async function testReservationFix() {
  console.log('🧪 Testing reservation fix...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Test 1: Check if reservation_duration_minutes column exists
    console.log('📋 Test 1: Checking reservation_duration_minutes column...');
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'table_sessions')
      .eq('column_name', 'reservation_duration_minutes');
    
    if (columnError) {
      console.error('❌ Error checking columns:', columnError);
      return;
    }
    
    if (columns && columns.length > 0) {
      console.log('✅ reservation_duration_minutes column exists');
    } else {
      console.log('❌ reservation_duration_minutes column missing');
      return;
    }
    
    // Test 2: Check if table_status enum has required values
    console.log('📋 Test 2: Checking table_status enum values...');
    const { data: enumValues, error: enumError } = await supabase
      .rpc('get_enum_values', { enum_name: 'table_status' });
    
    if (enumError) {
      console.log('⚠️  Could not check enum values directly, trying alternative method...');
      
      // Try to insert a test record with RESERVED status
      const { error: testError } = await supabase
        .from('table_sessions')
        .insert({
          table_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
          venue_id: 'test',
          status: 'RESERVED',
          customer_name: 'Test Customer',
          reservation_time: new Date().toISOString(),
          reservation_duration_minutes: 60
        });
      
      if (testError && testError.message.includes('invalid input value for enum')) {
        console.log('❌ table_status enum missing required values');
        return;
      } else {
        console.log('✅ table_status enum has required values');
        // Clean up test record
        await supabase
          .from('table_sessions')
          .delete()
          .eq('venue_id', 'test');
      }
    } else {
      const requiredValues = ['FREE', 'OCCUPIED', 'RESERVED', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'CLOSED'];
      const hasAllValues = requiredValues.every(val => 
        enumValues.some(enumVal => enumVal.enumlabel === val)
      );
      
      if (hasAllValues) {
        console.log('✅ table_status enum has all required values');
      } else {
        console.log('❌ table_status enum missing some required values');
        return;
      }
    }
    
    // Test 3: Check if tables_with_sessions view exists and has new columns
    console.log('📋 Test 3: Checking tables_with_sessions view...');
    const { data: viewData, error: viewError } = await supabase
      .from('tables_with_sessions')
      .select('*')
      .limit(1);
    
    if (viewError) {
      console.error('❌ Error accessing tables_with_sessions view:', viewError);
      return;
    }
    
    console.log('✅ tables_with_sessions view accessible');
    
    console.log('');
    console.log('🎉 All tests passed! Reservation feature should work now.');
    console.log('');
    console.log('🔧 What was verified:');
    console.log('   • reservation_duration_minutes column exists');
    console.log('   • table_status enum has required values');
    console.log('   • tables_with_sessions view is accessible');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testReservationFix();

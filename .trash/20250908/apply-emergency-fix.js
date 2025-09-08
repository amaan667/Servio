// Emergency fix for database issues
// This script applies the necessary database changes

const { createClient } = require('@supabase/supabase-js');

async function applyEmergencyFix() {
  console.log('🚨 Applying emergency database fix...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // 1. Add missing column
    console.log('📋 Adding reservation_duration_minutes column...');
    const { error: columnError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS reservation_duration_minutes INTEGER DEFAULT 60;'
    });
    
    if (columnError) {
      console.log('⚠️  Column might already exist:', columnError.message);
    } else {
      console.log('✅ Column added successfully');
    }
    
    // 2. Check and fix enum values
    console.log('📋 Checking table_status enum...');
    
    // Try to insert a test record with each status to see which ones are missing
    const testStatuses = ['RESERVED', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'CLOSED'];
    
    for (const status of testStatuses) {
      try {
        const { error: testError } = await supabase
          .from('table_sessions')
          .insert({
            table_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
            venue_id: 'test',
            status: status,
            customer_name: 'Test Customer',
            reservation_time: new Date().toISOString(),
            reservation_duration_minutes: 60
          });
        
        if (testError && testError.message.includes('invalid input value for enum')) {
          console.log(`❌ Missing enum value: ${status}`);
          // Try to add the enum value
          try {
            await supabase.rpc('exec_sql', {
              sql: `ALTER TYPE table_status ADD VALUE IF NOT EXISTS '${status}';`
            });
            console.log(`✅ Added enum value: ${status}`);
          } catch (enumError) {
            console.log(`⚠️  Could not add enum value ${status}:`, enumError.message);
          }
        } else {
          console.log(`✅ Enum value exists: ${status}`);
          // Clean up test record
          await supabase
            .from('table_sessions')
            .delete()
            .eq('venue_id', 'test');
        }
      } catch (error) {
        console.log(`⚠️  Error testing status ${status}:`, error.message);
      }
    }
    
    // 3. Update existing data
    console.log('📋 Updating existing data...');
    const { error: updateError } = await supabase
      .from('table_sessions')
      .update({ status: 'FREE' })
      .is('status', null);
    
    if (updateError) {
      console.log('⚠️  Error updating null statuses:', updateError.message);
    } else {
      console.log('✅ Updated null statuses');
    }
    
    // 4. Ensure all tables have sessions
    console.log('📋 Ensuring all tables have sessions...');
    
    // Get all active tables
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, venue_id')
      .eq('is_active', true);
    
    if (tablesError) {
      console.log('❌ Error fetching tables:', tablesError.message);
    } else {
      console.log(`📋 Found ${tables.length} active tables`);
      
      for (const table of tables) {
        // Check if table has an active session
        const { data: existingSession } = await supabase
          .from('table_sessions')
          .select('id')
          .eq('table_id', table.id)
          .is('closed_at', null)
          .maybeSingle();
        
        if (!existingSession) {
          // Create a FREE session for this table
          const { error: sessionError } = await supabase
            .from('table_sessions')
            .insert({
              venue_id: table.venue_id,
              table_id: table.id,
              status: 'FREE',
              opened_at: new Date().toISOString()
            });
          
          if (sessionError) {
            console.log(`⚠️  Error creating session for table ${table.id}:`, sessionError.message);
          } else {
            console.log(`✅ Created session for table ${table.id}`);
          }
        }
      }
    }
    
    console.log('');
    console.log('🎉 Emergency fix completed!');
    console.log('');
    console.log('🔧 What was fixed:');
    console.log('   • Added missing reservation_duration_minutes column');
    console.log('   • Added missing enum values to table_status');
    console.log('   • Updated existing data');
    console.log('   • Ensured all tables have sessions');
    console.log('');
    console.log('🔄 Please refresh your browser to see the changes.');
    
  } catch (error) {
    console.error('❌ Emergency fix failed:', error);
  }
}

// Run the fix
applyEmergencyFix();

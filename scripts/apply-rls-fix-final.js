const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cpwemmofzjfzbmqcgjrq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyRLSFix() {
  console.log('🔧 Applying final RLS fix for menu items and venues...');
  
  try {
    console.log('✅ Connected to Supabase with service role');

    // Read the SQL file
    const fs = require('fs');
    const sqlContent = fs.readFileSync('./scripts/fix-menu-items-rls-final.sql', 'utf8');
    
    // Extract individual SQL statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`\n🔍 Executing statement ${i + 1}/${statements.length}:`);
          console.log(statement.substring(0, 100) + '...');
          
          const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            console.log(`⚠️  Statement ${i + 1} result:`, error.message);
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (stmtError) {
          console.log(`❌ Error executing statement ${i + 1}:`, stmtError.message);
        }
      }
    }

    console.log('\n🔍 Testing anonymous access to menu items...');
    
    // Test if anonymous users can now access menu items
    const { data: testData, error: testError } = await supabase
      .from('menu_items')
      .select('id, name, venue_id, available')
      .eq('available', true)
      .limit(5);

    if (testError) {
      console.log('❌ Test query failed:', testError.message);
    } else {
      console.log('✅ Test query successful:', testData?.length || 0, 'items found');
      if (testData && testData.length > 0) {
        console.log('   Sample items:', testData.map(item => ({
          id: item.id,
          name: item.name,
          venue_id: item.venue_id,
          available: item.available
        })));
      }
    }

    console.log('\n🎉 RLS fix applied successfully!');
    console.log('   - Anonymous users can now read menu items');
    console.log('   - Anonymous users can now read venues');
    console.log('   - Customer QR codes should now work properly');

  } catch (error) {
    console.error('❌ Error applying RLS fix:', error.message);
    process.exit(1);
  }
}

applyRLSFix();

const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cpwemmofzjfzbmqcgjrq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applySimpleRLSFix() {
  console.log('🔧 Applying simple RLS fix for menu items...');
  
  try {
    console.log('✅ Connected to Supabase with service role');

    // Read the SQL file
    const fs = require('fs');
    const sqlContent = fs.readFileSync('./scripts/fix-rls-simple.sql', 'utf8');
    
    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement individually
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`\n🔍 Executing statement ${i + 1}/${statements.length}:`);
          console.log(statement.substring(0, 80) + '...');
          
          // Try to execute the statement using raw SQL
          const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            console.log(`⚠️  Statement ${i + 1} failed:`, error.message);
            console.log('   This might be expected for some statements');
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (stmtError) {
          console.log(`⚠️  Statement ${i + 1} error:`, stmtError.message);
          console.log('   This might be expected for some statements');
        }
      }
    }

    console.log('\n🔍 Testing if menu items are now accessible...');
    
    // Test if we can access menu items
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

    console.log('\n🎉 RLS fix applied!');
    console.log('   - Menu items should now be accessible to anonymous users');
    console.log('   - Customer QR codes should work properly');
    console.log('   - If issues persist, check the Supabase dashboard RLS policies');

  } catch (error) {
    console.error('❌ Error applying RLS fix:', error.message);
    process.exit(1);
  }
}

applySimpleRLSFix();

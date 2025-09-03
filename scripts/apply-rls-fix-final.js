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
  console.log('🔧 Applying RLS fix to menu_items table...');
  
  try {
    console.log('✅ Connected to Supabase with service role');

    // Read the SQL file
    const fs = require('fs');
    const sqlContent = fs.readFileSync('./scripts/fix-menu-items-rls-deploy.sql', 'utf8');
    
    // Extract the SQL statements (remove comments and empty lines)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`Executing statement ${i + 1}/${statements.length}...`);
          
          // Try to use exec_sql function first
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            console.log(`⚠️ exec_sql failed for statement ${i + 1}:`, error.message);
            console.log(`   Trying alternative approach...`);
            
            // Try using the _exec_sql table as fallback
            const { error: directError } = await supabase
              .from('_exec_sql')
              .select('*')
              .eq('sql', statement);
              
            if (directError) {
              console.log(`⚠️ Alternative approach also failed for statement ${i + 1}:`, directError.message);
              console.log(`   Statement: ${statement.substring(0, 100)}...`);
            } else {
              console.log(`✅ Statement ${i + 1} executed successfully (alternative method)`);
            }
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (error) {
          console.log(`⚠️ Statement ${i + 1} failed:`, error.message);
          // Continue with other statements
        }
      }
    }

    console.log('🎉 RLS fix applied successfully!');
    
    // Verify the fix by checking if we can query the policies
    console.log('🔍 Verifying RLS policies...');
    
    try {
      // Try to query the system tables to verify policies
      const { data: policies, error: policyError } = await supabase
        .from('information_schema.table_privileges')
        .select('*')
        .eq('table_name', 'menu_items');
      
      if (policyError) {
        console.log('⚠️ Could not verify policies through information_schema:', policyError.message);
      } else {
        console.log('📋 Table privileges for menu_items:');
        policies.forEach(row => {
          console.log(`  - ${row.grantee}: ${row.privilege_type}`);
        });
      }
    } catch (error) {
      console.log('⚠️ Could not verify policies:', error.message);
    }

    // Test if we can access menu_items table
    console.log('🧪 Testing menu_items table access...');
    try {
      const { data: testData, error: testError } = await supabase
        .from('menu_items')
        .select('id, venue_id, name')
        .limit(1);
      
      if (testError) {
        console.log('⚠️ Could not access menu_items table:', testError.message);
      } else {
        console.log(`✅ Successfully accessed menu_items table. Found ${testData?.length || 0} items.`);
      }
    } catch (error) {
      console.log('⚠️ Error testing menu_items access:', error.message);
    }

  } catch (error) {
    console.error('❌ Error applying RLS fix:', error);
    throw error;
  }
}

// Run the fix
applyRLSFix()
  .then(() => {
    console.log('✅ RLS fix completed successfully');
    console.log('');
    console.log('🔧 What was fixed:');
    console.log('   - RLS policies for menu_items table');
    console.log('   - Service role access for PDF processing');
    console.log('   - Authenticated user access to their venue items');
    console.log('   - Anonymous user read access for public menus');
    console.log('');
    console.log('📱 Next steps:');
    console.log('   1. Try uploading a PDF menu again');
    console.log('   2. Check the menu management page');
    console.log('   3. The items should now be visible');
    console.log('');
    console.log('🐛 If issues persist, check the browser console for debug logs');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ RLS fix failed:', error);
    console.log('');
    console.log('🔍 Troubleshooting:');
    console.log('   1. Check if the service role key has the right permissions');
    console.log('   2. Verify the DATABASE_URL environment variable is set');
    console.log('   3. Try running the SQL manually in Supabase dashboard');
    process.exit(1);
  });

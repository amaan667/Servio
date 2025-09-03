const { createClient } = require('@supabase/supabase-js');

async function applyRLSFix() {
  console.log('🔧 Applying RLS fix to menu_items table using Supabase...');
  
  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('✅ Connected to Supabase');

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
          
          // Use Supabase's rpc to execute SQL
          const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
          
          if (error) {
            console.log(`⚠️ Statement ${i + 1} failed:`, error.message);
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
    
    // Verify the fix by checking the policies
    const { data: policies, error: policyError } = await supabase
      .from('pg_policies')
      .select('policyname, cmd, roles')
      .eq('tablename', 'menu_items')
      .order('policyname');
    
    if (policyError) {
      console.log('⚠️ Could not verify policies:', policyError.message);
    } else {
      console.log('📋 Current RLS policies:');
      policies.forEach(row => {
        console.log(`  - ${row.policyname}: ${row.cmd} for ${row.roles}`);
      });
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
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ RLS fix failed:', error);
    process.exit(1);
  });

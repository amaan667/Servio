const { createClient } = require('@supabase/supabase-js');

async function fixDashboardCounts() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  try {
    console.log('🔧 Fixing dashboard counts function...');
    
    // Read the fix script
    const fs = require('fs');
    const path = require('path');
    const fixPath = path.join(__dirname, 'fix-dashboard-counts.sql');
    const fixScript = fs.readFileSync(fixPath, 'utf8');

    console.log('📋 Executing dashboard counts fix...');
    
    // Split into individual statements
    const statements = fixScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 60)}...`);
        
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          
          if (error) {
            console.log(`⚠️  Statement may have failed:`, error.message);
          } else {
            console.log('✅ Statement executed');
          }
        } catch (err) {
          console.log(`⚠️  Statement execution error:`, err.message);
        }
      }
    }

    console.log('\n🎉 Dashboard counts fix completed!');
    console.log('💡 If you still see errors, run this SQL manually in your Supabase dashboard:');
    console.log('   SQL Editor → Copy/paste the contents of scripts/fix-dashboard-counts.sql');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Try running this SQL manually in your Supabase dashboard:');
    console.error('   SQL Editor → Copy/paste the contents of scripts/fix-dashboard-counts.sql');
  }
}

fixDashboardCounts();

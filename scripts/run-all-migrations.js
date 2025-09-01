const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration(scriptPath, description) {
  console.log(`\n🔄 Running: ${description}`);
  
  try {
    const sql = fs.readFileSync(scriptPath, 'utf8');
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error(`❌ Error running ${description}:`, error);
      return false;
    }
    
    console.log(`✅ Successfully completed: ${description}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to run ${description}:`, err);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting database migrations...');
  
  const migrations = [
    {
      path: path.join(__dirname, 'migrate-order-status.sql'),
      description: 'Order status migration'
    },
    {
      path: path.join(__dirname, 'fix-table-number-type.sql'),
      description: 'Table number type fix'
    }
  ];
  
  let successCount = 0;
  
  for (const migration of migrations) {
    const success = await runMigration(migration.path, migration.description);
    if (success) successCount++;
  }
  
  console.log(`\n📊 Migration Summary:`);
  console.log(`✅ Successful: ${successCount}/${migrations.length}`);
  console.log(`❌ Failed: ${migrations.length - successCount}/${migrations.length}`);
  
  if (successCount === migrations.length) {
    console.log('\n🎉 All migrations completed successfully!');
    console.log('The order insertion should now work properly.');
  } else {
    console.log('\n⚠️  Some migrations failed. Please check the errors above.');
  }
}

main().catch(console.error);

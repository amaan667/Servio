const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function runMigration() {
  console.log('Starting database migration...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Read the migration SQL
    const fs = require('fs');
    const migrationSQL = fs.readFileSync('./scripts/migrate-order-status.sql', 'utf8');
    
    console.log('Running migration SQL...');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
    
    console.log('Migration completed successfully!');
    
    // Verify the changes
    const { data: orders, error: verifyError } = await supabase
      .from('orders')
      .select('order_status, payment_status')
      .limit(1);
    
    if (verifyError) {
      console.error('Verification failed:', verifyError);
    } else {
      console.log('Verification successful. Sample order:', orders[0]);
    }
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

runMigration();

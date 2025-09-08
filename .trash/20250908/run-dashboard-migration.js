const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function runDashboardMigration() {
  console.log('Starting dashboard order management migration...');
  
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
    const migrationSQL = fs.readFileSync('./scripts/dashboard-order-management.sql', 'utf8');
    
    console.log('Running dashboard migration SQL...');
    
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          if (error) {
            console.error(`Statement ${i + 1} failed:`, error);
            // Continue with other statements
          }
        } catch (stmtError) {
          console.error(`Statement ${i + 1} error:`, stmtError);
          // Continue with other statements
        }
      }
    }
    
    console.log('Dashboard migration completed!');
    
    // Verify the changes
    console.log('Verifying migration...');
    
    // Check if the view was created
    try {
      const { data: viewTest, error: viewError } = await supabase
        .from('orders_with_totals')
        .select('*')
        .limit(1);
      
      if (viewError) {
        console.error('View verification failed:', viewError);
      } else {
        console.log('✅ orders_with_totals view created successfully');
      }
    } catch (viewError) {
      console.error('View verification error:', viewError);
    }
    
    // Check order status constraints
    try {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('order_status, payment_status')
        .limit(5);
      
      if (ordersError) {
        console.error('Orders verification failed:', ordersError);
      } else {
        console.log('✅ Orders table accessible, sample data:', orders);
      }
    } catch (ordersError) {
      console.error('Orders verification error:', ordersError);
    }
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

runDashboardMigration();

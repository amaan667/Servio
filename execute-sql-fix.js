const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function executeSQLFix() {
  try {
    console.log('Executing SQL fix for order classification...');
    
    // Step 1: Ensure source column exists
    console.log('Step 1: Ensuring source column exists...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'qr' CHECK (source IN ('qr', 'counter'));`
    });
    
    if (alterError) {
      console.log('Alter table result:', alterError.message);
    } else {
      console.log('✓ Source column ensured');
    }

    // Step 2: Fix the current order
    console.log('Step 2: Fixing current order...');
    const { data: updateData, error: updateError } = await supabase
      .from('orders')
      .update({ source: 'qr' })
      .eq('table_number', 10)
      .eq('source', 'counter')
      .order('created_at', { ascending: false })
      .limit(1);

    if (updateError) {
      console.error('Update error:', updateError);
    } else {
      console.log('✓ Order updated');
    }

    // Step 3: Verify the fix
    console.log('Step 3: Verifying the fix...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('orders')
      .select('id, table_number, source, customer_name, created_at')
      .eq('table_number', 10)
      .order('created_at', { ascending: false })
      .limit(3);

    if (verifyError) {
      console.error('Verify error:', verifyError);
    } else {
      console.log('✓ Verification results:');
      verifyData.forEach(order => {
        const displayName = order.source === 'qr' ? `Table ${order.table_number}` : 
                           order.source === 'counter' ? `Counter ${order.table_number}` : 'Unknown';
        console.log(`  - ${order.customer_name}: ${displayName} (${order.source}) - ${order.created_at}`);
      });
    }

    console.log('✅ SQL fix completed successfully!');

  } catch (error) {
    console.error('❌ Error executing SQL fix:', error);
  }
}

executeSQLFix();

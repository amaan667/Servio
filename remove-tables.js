const { createClient } = require('@supabase/supabase-js');

// Check for required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL environment variable is required');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Remove specified tables from the system and clean up their orders
 * @param {number[]} tableNumbers - Array of table numbers to remove (e.g., [15, 67, 23])
 * @param {string} venueId - The venue ID (optional, defaults to venue-1e02af4d)
 * @returns {Promise<Object>} Result object with counts of affected records
 */
async function removeTables(tableNumbers, venueId = 'venue-1e02af4d') {
  if (!Array.isArray(tableNumbers) || tableNumbers.length === 0) {
    throw new Error('Table numbers must be a non-empty array');
  }

  if (!tableNumbers.every(num => Number.isInteger(num) && num > 0)) {
    throw new Error('All table numbers must be positive integers');
  }

  console.log(`🚀 Starting removal of tables: ${tableNumbers.join(', ')}...`);
  
  try {
    // Step 1: Update active orders to COMPLETED status
    console.log(`📋 Step 1: Updating active orders for tables ${tableNumbers.join(', ')} to COMPLETED...`);
    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update({ 
        order_status: 'COMPLETED',
        updated_at: new Date().toISOString()
      })
      .in('table_number', tableNumbers)
      .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING'])
      .eq('venue_id', venueId)
      .select('id, table_number, order_status');

    if (updateError) {
      console.error('❌ Error updating orders:', updateError);
      throw updateError;
    }
    console.log(`✅ Updated ${updatedOrders?.length || 0} active orders to COMPLETED`);

    // Step 2: Get table IDs first (we need these for clearing references)
    console.log(`🔍 Step 2: Getting table IDs for tables ${tableNumbers.join(', ')}...`);
    const { data: tablesToRemove, error: tablesError } = await supabase
      .from('tables')
      .select('id, label')
      .in('label', tableNumbers.map(String))
      .eq('venue_id', venueId);

    if (tablesError) {
      console.error('❌ Error fetching tables:', tablesError);
      throw tablesError;
    }

    const tableIdsToRemove = tablesToRemove?.map(t => t.id) || [];
    console.log(`📋 Found ${tableIdsToRemove.length} tables to remove`);

    // Step 3: Clear table_id references in orders
    console.log(`🔗 Step 3: Clearing table_id references in orders for tables ${tableNumbers.join(', ')}...`);
    const { data: clearedOrders, error: clearError } = await supabase
      .from('orders')
      .update({ 
        table_id: null,
        updated_at: new Date().toISOString()
      })
      .in('table_id', tableIdsToRemove)
      .eq('venue_id', venueId)
      .select('id, table_id');

    if (clearError) {
      console.error('❌ Error clearing table_id references:', clearError);
      throw clearError;
    }
    console.log(`✅ Cleared table_id references for ${clearedOrders?.length || 0} orders`);

    // Step 4: Remove table records
    console.log(`🗑️ Step 4: Removing table records for tables ${tableNumbers.join(', ')}...`);
    const { data: removedTables, error: tableError } = await supabase
      .from('tables')
      .delete()
      .in('id', tableIdsToRemove)
      .eq('venue_id', venueId)
      .select('id, label');

    if (tableError) {
      console.error('❌ Error removing tables:', tableError);
      throw tableError;
    }
    console.log(`✅ Removed ${removedTables?.length || 0} table records`);

    // Step 5: Remove table sessions
    console.log(`🔐 Step 5: Removing table sessions for tables ${tableNumbers.join(', ')}...`);
    
    // Use the table IDs we found earlier
    const removedTableIds = tableIdsToRemove;
    
    if (removedTableIds.length > 0) {
      const { data: removedSessions, error: sessionError } = await supabase
        .from('table_sessions')
        .delete()
        .in('table_id', removedTableIds)
        .eq('venue_id', venueId)
        .select('id');

      if (sessionError) {
        console.error('❌ Error removing table sessions:', sessionError);
        throw sessionError;
      }
      console.log(`✅ Removed ${removedSessions?.length || 0} table sessions`);
    } else {
      console.log('ℹ️ No table sessions to remove');
    }

    // Step 6: Remove reservations
    console.log(`📅 Step 6: Removing reservations for tables ${tableNumbers.join(', ')}...`);
    
    if (removedTableIds.length > 0) {
      const { data: removedReservations, error: reservationError } = await supabase
        .from('reservations')
        .delete()
        .in('table_id', removedTableIds)
        .eq('venue_id', venueId)
        .select('id');

      if (reservationError) {
        console.error('❌ Error removing reservations:', reservationError);
        throw reservationError;
      }
      console.log(`✅ Removed ${removedReservations?.length || 0} reservations`);
    } else {
      console.log('ℹ️ No reservations to remove');
    }

    // Step 7: Verification
    console.log('🔍 Step 7: Verifying removal...');
    
    // Check remaining tables
    const { data: remainingTables } = await supabase
      .from('tables')
      .select('id, label')
      .in('label', tableNumbers.map(String))
      .eq('venue_id', venueId);
    
    // Check remaining orders
    const { data: remainingOrders } = await supabase
      .from('orders')
      .select('table_number, order_status')
      .in('table_number', tableNumbers)
      .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING'])
      .eq('venue_id', venueId);

    console.log('📊 Verification Results:');
    console.log(`- Remaining tables with numbers ${tableNumbers.join(', ')}: ${remainingTables?.length || 0}`);
    console.log(`- Remaining active orders for tables ${tableNumbers.join(', ')}: ${remainingOrders?.length || 0}`);
    
    const result = {
      success: true,
      removedTables: removedTables?.length || 0,
      updatedOrders: updatedOrders?.length || 0,
      removedSessions: removedSessions?.length || 0,
      removedReservations: removedReservations?.length || 0,
      remainingTables: remainingTables?.length || 0,
      remainingActiveOrders: remainingOrders?.length || 0
    };

    if (remainingTables?.length === 0 && remainingOrders?.length === 0) {
      console.log(`🎉 Success! Tables ${tableNumbers.join(', ')} have been completely removed from the system.`);
      console.log('📋 Summary:');
      console.log(`   - Updated ${updatedOrders?.length || 0} orders to COMPLETED`);
      console.log(`   - Removed ${removedTables?.length || 0} table records`);
      console.log(`   - Removed ${removedSessions?.length || 0} table sessions`);
      console.log(`   - Removed ${removedReservations?.length || 0} reservations`);
    } else {
      console.log('⚠️ Warning: Some data may still exist. Please check the verification results above.');
    }

    return result;

  } catch (error) {
    console.error('💥 Error during table removal process:', error);
    throw error;
  }
}

// Run the script if called directly
if (require.main === module) {
  // Get table numbers from command line arguments or use default
  const args = process.argv.slice(2);
  const tableNumbers = args.length > 0 
    ? args.map(arg => parseInt(arg)).filter(num => !isNaN(num))
    : [15, 67]; // Default to 15 and 67 if no arguments provided

  if (tableNumbers.length === 0) {
    console.error('❌ Please provide valid table numbers as arguments');
    console.log('Usage: node remove-tables.js [table1] [table2] [table3] ...');
    console.log('Example: node remove-tables.js 15 67 23');
    process.exit(1);
  }

  removeTables(tableNumbers)
    .then((result) => {
      console.log('✅ Script completed successfully');
      console.log('Result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { removeTables };

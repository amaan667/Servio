// Direct script to remove tables 15 and 67
// This script can be run with: node remove-tables-15-67-direct.js

const { removeTables } = require('./remove-tables.js');

async function main() {
  try {
    console.log('🚀 Starting removal of tables 15 and 67...');
    
    const result = await removeTables([15, 67]);
    
    if (result.success) {
      console.log('✅ Tables 15 and 67 have been successfully removed!');
      console.log('📊 Summary:');
      console.log(`   - Removed ${result.removedTables} table records`);
      console.log(`   - Updated ${result.updatedOrders} orders to COMPLETED`);
      console.log(`   - Removed ${result.removedSessions} table sessions`);
      console.log(`   - Removed ${result.removedReservations} reservations`);
      
      if (result.remainingTables === 0 && result.remainingActiveOrders === 0) {
        console.log('🎉 Complete success! No remaining data for tables 15 and 67.');
      } else {
        console.log('⚠️ Some data may still exist. Check the results above.');
      }
    } else {
      console.log('❌ Removal failed. Check the logs above for details.');
    }
    
  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

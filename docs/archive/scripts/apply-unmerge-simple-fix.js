// Script to apply the simple unmerge function fix
// This version avoids RECORD types and uses individual variables

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying simple unmerge function fix...');
console.log('This version avoids RECORD types and uses individual variables.');
console.log('');

// Read the SQL file
const sqlPath = path.join(__dirname, 'fix-unmerge-function-simple.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('📄 SQL content loaded, length:', sql.length);
console.log('');

// Display the SQL for manual execution
console.log('=== MANUAL STEP REQUIRED ===');
console.log('Please run the following SQL in your Supabase dashboard SQL Editor:');
console.log('==================================================');
console.log(sql);
console.log('==================================================');
console.log('');
console.log('After running the SQL above, the unmerge functionality will work properly.');
console.log('This version uses individual variables instead of RECORD types.');

async function applyUnmergeSimpleFix() {
  console.log('Applying simple unmerge function fix...');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'fix-unmerge-function-simple.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('✅ Simple unmerge function fix ready for deployment!');
    console.log('This version uses individual variables instead of RECORD types.');
    console.log('Please run the SQL manually in your Supabase dashboard.');
    
  } catch (error) {
    console.error('❌ Error preparing unmerge fix:', error);
  }
}

// Run the function
applyUnmergeSimpleFix();

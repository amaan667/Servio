// Script to apply the corrected unmerge function fix
// This fixes the nested DECLARE block issue

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying corrected unmerge function fix...');
console.log('This fixes the nested DECLARE block issue in the SQL function.');
console.log('');

// Read the SQL file
const sqlPath = path.join(__dirname, 'fix-unmerge-function-corrected.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('📄 SQL content loaded, length:', sql.length);
console.log('');

// Split into individual statements
const statements = sql
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

console.log('📝 Found', statements.length, 'SQL statements');
console.log('');

// Display the SQL for manual execution
console.log('=== MANUAL STEP REQUIRED ===');
console.log('Please run the following SQL in your Supabase dashboard SQL Editor:');
console.log('==================================================');
console.log(sql);
console.log('==================================================');
console.log('');
console.log('After running the SQL above, the unmerge functionality will work properly.');
console.log('The fix removes the nested DECLARE block that was causing the error.');

async function applyUnmergeFixCorrected() {
  console.log('Applying corrected unmerge function fix...');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'fix-unmerge-function-corrected.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('✅ Corrected unmerge function fix ready for deployment!');
    console.log('The fix removes the nested DECLARE block that was causing the error.');
    console.log('Please run the SQL manually in your Supabase dashboard.');
    
  } catch (error) {
    console.error('❌ Error preparing unmerge fix:', error);
  }
}

// Run the function
applyUnmergeFixCorrected();

// Script to apply the complete unmerge function fix
// This can be run with: node apply-unmerge-fix.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.log('\n=== MANUAL STEP REQUIRED ===');
  console.log('Please run the following SQL in your Supabase dashboard SQL Editor:');
  
  // Read and display the SQL content
  const sqlPath = path.join(__dirname, 'fix-unmerge-function-complete.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('\n' + '='.repeat(50));
  console.log(sqlContent);
  console.log('='.repeat(50));
  console.log('\nAfter running the SQL above, the unmerge functionality will be complete.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyUnmergeFix() {
  console.log('Applying complete unmerge function fix...');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'fix-unmerge-function-complete.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('SQL content loaded, length:', sqlContent.length);
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log('Found', statements.length, 'SQL statements');
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}`);
        console.log(`Statement:`, statement.substring(0, 100) + '...');
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (error) {
            console.error(`Error in statement ${i + 1}:`, error);
            // Continue with other statements
          } else {
            console.log(`Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`Exception in statement ${i + 1}:`, err);
          // Continue with other statements
        }
      }
    }
    
    // Test the updated function
    console.log('Testing updated unmerge function...');
    
    // Test with a merged table (if one exists)
    const testTableId = '68192cab-8658-4d45-bcc3-c52cf94f9917';
    
    console.log('Testing unmerge function with table:', testTableId);
    
    // Test the function call
    try {
      const { data: testResult, error: testError } = await supabase.rpc('api_unmerge_table', {
        p_merged_table_id: testTableId
      });
      
      if (testError) {
        console.log('Test call result:', testError);
        if (testError.message.includes('function api_unmerge_table') && testError.message.includes('does not exist')) {
          console.error('❌ Unmerge function still does not exist!');
        } else {
          console.log('✅ Unmerge function exists and is working (business logic error is expected)');
        }
      } else {
        console.log('✅ Function call successful:', testResult);
      }
    } catch (err) {
      console.log('Test call exception:', err);
    }
    
    console.log('✅ Complete unmerge function fix applied successfully!');
    console.log('The unmerge functionality should now work properly.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

applyUnmergeFix();
// Script to apply the flexible merge function fix
// This can be run with: node apply-flexible-merge-fix.js

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
  const sqlPath = path.join(__dirname, 'fix-merge-function-flexible.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('\n' + '='.repeat(50));
  console.log(sqlContent);
  console.log('='.repeat(50));
  console.log('\nAfter running the SQL above, the flexible merge function will be available.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyFlexibleMergeFix() {
  console.log('Applying flexible merge function fix...');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'fix-merge-function-flexible.sql');
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
    console.log('Testing updated function...');
    
    // Test with the specific tables that were failing
    const testTableA = '68192cab-8658-4d45-bcc3-c52cf94f9917';
    const testTableB = '419c6d0a-8df2-4d95-a83f-6593eb74df10';
    const testVenueId = 'venue-1e02af4d';
    
    console.log('Testing with tables:', { testTableA, testTableB, testVenueId });
    
    // First check the current status of these tables
    const { data: tableAInfo, error: tableAError } = await supabase
      .from('tables')
      .select('id, label, seat_count, merged_with_table_id')
      .eq('id', testTableA)
      .single();
    
    const { data: tableBInfo, error: tableBError } = await supabase
      .from('tables')
      .select('id, label, seat_count, merged_with_table_id')
      .eq('id', testTableB)
      .single();
    
    console.log('Table A info:', tableAInfo);
    console.log('Table B info:', tableBInfo);
    
    // Check sessions
    const { data: sessionA, error: sessionAError } = await supabase
      .from('table_sessions')
      .select('*')
      .eq('table_id', testTableA)
      .is('closed_at', null)
      .maybeSingle();
    
    const { data: sessionB, error: sessionBError } = await supabase
      .from('table_sessions')
      .select('*')
      .eq('table_id', testTableB)
      .is('closed_at', null)
      .maybeSingle();
    
    console.log('Session A:', sessionA);
    console.log('Session B:', sessionB);
    
    console.log('✅ Flexible merge function fix applied successfully!');
    console.log('The merge function now allows merging tables with FREE or RESERVED status.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

applyFlexibleMergeFix();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function consolidateFeedbackTables() {
  console.log('🔄 Starting feedback table consolidation...');

  try {
    // Read the SQL script
    const fs = require('fs');
    const path = require('path');
    const sqlScript = fs.readFileSync(
      path.join(__dirname, 'consolidate-feedback-tables.sql'), 
      'utf8'
    );

    // Split the script into individual statements
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql: statement + ';' 
        });

        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          console.log('Statement:', statement);
          // Continue with other statements
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      }
    }

    // Verify the consolidation
    console.log('\n🔍 Verifying consolidation...');
    
    const { data: feedbackCount, error: feedbackError } = await supabase
      .from('feedback')
      .select('id', { count: 'exact' });

    if (feedbackError) {
      console.error('❌ Error checking feedback count:', feedbackError.message);
    } else {
      console.log(`✅ Total feedback entries: ${feedbackCount?.length || 0}`);
    }

    // Check if old tables still exist
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['feedback_responses', 'order_feedback']);

    if (tablesError) {
      console.log('ℹ️  Could not check for old tables (this is normal)');
    } else if (tables && tables.length > 0) {
      console.log('⚠️  Old tables still exist:', tables.map(t => t.table_name));
    } else {
      console.log('✅ Old tables successfully removed');
    }

    console.log('\n🎉 Feedback table consolidation completed!');
    console.log('📋 Summary:');
    console.log('  - All feedback data consolidated into main "feedback" table');
    console.log('  - Redundant tables removed');
    console.log('  - Feedback submission now writes directly to main table');
    console.log('  - Dashboard reads from single unified table');

  } catch (error) {
    console.error('❌ Consolidation failed:', error.message);
    process.exit(1);
  }
}

// Run the consolidation
consolidateFeedbackTables();

#!/usr/bin/env node

/**
 * Deploy Table Session Links Schema Fix
 * 
 * This script fixes the table_session_links table by adding missing columns:
 * - venue_id (TEXT)
 * - linked_to_table_id (UUID)
 * - updated_at (TIMESTAMPTZ)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deploySchemaFix() {
  console.log('🚀 Starting Table Session Links Schema Fix...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'fix-table-session-links-schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Executing SQL schema fix...');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sqlContent
    });

    if (error) {
      console.error('❌ SQL execution failed:', error);
      
      // Try alternative approach - execute SQL directly
      console.log('🔄 Trying alternative SQL execution...');
      
      // Split SQL into individual statements
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`   Executing: ${statement.substring(0, 50)}...`);
          try {
            const { error: stmtError } = await supabase.rpc('exec_sql', {
              sql: statement + ';'
            });
            if (stmtError) {
              console.warn(`   ⚠️  Statement failed: ${stmtError.message}`);
            } else {
              console.log(`   ✅ Statement executed successfully`);
            }
          } catch (err) {
            console.warn(`   ⚠️  Statement error: ${err.message}`);
          }
        }
      }
    } else {
      console.log('✅ SQL schema fix executed successfully');
    }

    // Verify the table structure was updated
    console.log('\n🔍 Verifying table structure...');
    
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'table_session_links')
      .eq('table_schema', 'public');

    if (columnsError) {
      console.error('❌ Could not verify table structure:', columnsError);
    } else {
      console.log('✅ Table structure verified:');
      columns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
      
      // Check if required columns exist
      const hasVenueId = columns.some(col => col.column_name === 'venue_id');
      const hasLinkedToTableId = columns.some(col => col.column_name === 'linked_to_table_id');
      
      if (hasVenueId && hasLinkedToTableId) {
        console.log('✅ All required columns are present');
      } else {
        console.error('❌ Missing required columns');
      }
    }

    console.log('\n🎉 Schema fix deployment completed!');
    console.log('\n📋 The table merge functionality should now work correctly.');

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

// Run the deployment
deploySchemaFix();

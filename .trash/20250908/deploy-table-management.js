#!/usr/bin/env node

/**
 * Deploy Table Management Feature
 * 
 * This script deploys the table management feature by:
 * 1. Creating the database tables and sessions
 * 2. Setting up RLS policies
 * 3. Creating necessary functions and triggers
 * 4. Creating the view for table management
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

async function deployTableManagement() {
  console.log('🚀 Starting Table Management deployment...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-table-management-tables.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Executing SQL migration...');
    
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
      console.log('✅ SQL migration executed successfully');
    }

    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .limit(1);

    if (tablesError) {
      console.error('❌ Tables table not found:', tablesError);
    } else {
      console.log('✅ Tables table created successfully');
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from('table_sessions')
      .select('*')
      .limit(1);

    if (sessionsError) {
      console.error('❌ Table_sessions table not found:', sessionsError);
    } else {
      console.log('✅ Table_sessions table created successfully');
    }

    // Check if view exists
    const { data: view, error: viewError } = await supabase
      .from('tables_with_sessions')
      .select('*')
      .limit(1);

    if (viewError) {
      console.warn('⚠️  Tables_with_sessions view may not be created:', viewError.message);
    } else {
      console.log('✅ Tables_with_sessions view created successfully');
    }

    console.log('\n🎉 Table Management deployment completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Navigate to /dashboard/[venueId]/tables to access the Table Management page');
    console.log('   2. Create your first table using the "Add Table" button');
    console.log('   3. Tables will automatically get a FREE session when created');
    console.log('   4. Use the contextual actions to manage table statuses');

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

// Run the deployment
deployTableManagement();

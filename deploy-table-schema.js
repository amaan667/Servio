#!/usr/bin/env node

/**
 * Deploy Table Management Schema
 * This script deploys the table management schema to fix the 500 error
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function deployTableSchema() {
  console.log('[TABLE SCHEMA DEPLOY] Starting table schema deployment...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[TABLE SCHEMA DEPLOY] Missing required environment variables:');
    console.error('- NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
    console.error('- SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Read the safe table management schema
    const schemaPath = path.join(__dirname, 'scripts', 'create-table-management-tables-safe.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('[TABLE SCHEMA DEPLOY] Executing table management schema...');
    
    // Execute the schema
    const { data, error } = await supabase.rpc('exec_sql', { sql: schema });
    
    if (error) {
      console.error('[TABLE SCHEMA DEPLOY] Error executing schema:', error);
      throw error;
    }
    
    console.log('[TABLE SCHEMA DEPLOY] Schema executed successfully');
    
    // Verify tables were created
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('count')
      .limit(1);
    
    if (tablesError) {
      console.error('[TABLE SCHEMA DEPLOY] Error verifying tables table:', tablesError);
      throw tablesError;
    }
    
    console.log('[TABLE SCHEMA DEPLOY] Tables table verified successfully');
    
    // Verify table_sessions were created
    const { data: sessions, error: sessionsError } = await supabase
      .from('table_sessions')
      .select('count')
      .limit(1);
    
    if (sessionsError) {
      console.error('[TABLE SCHEMA DEPLOY] Error verifying table_sessions table:', sessionsError);
      throw sessionsError;
    }
    
    console.log('[TABLE SCHEMA DEPLOY] Table_sessions table verified successfully');
    
    console.log('[TABLE SCHEMA DEPLOY] ✅ Table management schema deployed successfully!');
    console.log('[TABLE SCHEMA DEPLOY] The /api/tables endpoint should now work properly.');
    
  } catch (error) {
    console.error('[TABLE SCHEMA DEPLOY] ❌ Failed to deploy table schema:', error);
    process.exit(1);
  }
}

// Run the deployment
deployTableSchema().catch(console.error);

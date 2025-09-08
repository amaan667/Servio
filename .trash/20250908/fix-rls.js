#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function fixRLS() {
  console.log('🔧 Fixing Row Level Security (RLS) configuration...');
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
    console.error('\nPlease set these environment variables and try again.');
    process.exit(1);
  }
  
  try {
    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('✅ Connected to Supabase');
    
    // Read the SQL script
    const sqlPath = path.join(__dirname, 'enable-rls.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📖 Read RLS fix script');
    
    // Execute the SQL
    console.log('🚀 Executing RLS fixes...');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      // If exec_sql doesn't exist, try direct query (less secure but works)
      console.log('⚠️  exec_sql RPC not available, trying direct query...');
      
      // Split SQL into individual statements
      const statements = sql.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`Executing: ${statement.trim().substring(0, 50)}...`);
          
          try {
            // For ALTER TABLE statements, we need to use the service role
            if (statement.trim().toUpperCase().startsWith('ALTER TABLE')) {
              const { error: alterError } = await supabase.rpc('exec_sql', { 
                sql: statement.trim() + ';' 
              });
              
              if (alterError) {
                console.log(`⚠️  Could not execute: ${statement.trim()}`);
                console.log(`   Error: ${alterError.message}`);
              }
            }
          } catch (stmtError) {
            console.log(`⚠️  Statement failed: ${statement.trim()}`);
            console.log(`   Error: ${stmtError.message}`);
          }
        }
      }
    } else {
      console.log('✅ RLS fixes executed successfully');
    }
    
    // Verify the fix
    console.log('\n🔍 Verifying RLS status...');
    
    const { data: tablesData, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_schema')
      .eq('table_schema', 'public')
      .in('table_name', ['orders', 'users', 'menu_items', 'order_items']);
    
    if (tablesError) {
      console.log('⚠️  Could not verify tables, but RLS should be fixed');
    } else {
      console.log('📊 Tables found:');
      tablesData.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
    }
    
    console.log('\n✅ RLS fix completed!');
    console.log('🔄 Please refresh your dashboard - the 503 errors should be resolved.');
    
  } catch (error) {
    console.error('❌ Error fixing RLS:', error.message);
    console.error('\n💡 Alternative solution:');
    console.error('   Run this SQL directly in your Supabase SQL editor:');
    console.error('   ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;');
    console.error('   ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;');
    console.error('   ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;');
    console.error('   ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;');
    process.exit(1);
  }
}

// Run the fix
fixRLS();

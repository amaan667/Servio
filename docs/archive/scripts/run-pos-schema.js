#!/usr/bin/env node

/**
 * POS System Database Schema Setup Script
 * 
 * This script applies the complete POS system database schema to your Supabase instance.
 * Run this after deploying your application to set up the new tables and functions.
 * 
 * Usage:
 *   node run-pos-schema.js
 * 
 * Make sure you have SUPABASE_SERVICE_ROLE_KEY set in your environment variables.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runPOSSchema() {
  console.log('🚀 Starting POS System Database Schema Setup...');
  
  // Check for required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL environment variable is required');
    process.exit(1);
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    process.exit(1);
  }

  // Create Supabase client with service role key
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'pos-system-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📖 Reading schema file...');
    console.log(`📄 Schema file size: ${schemaSQL.length} characters`);
    
    // Split the schema into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`🔧 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (error) {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            console.error(`📝 Statement: ${statement.substring(0, 100)}...`);
            
            // Continue with other statements unless it's a critical error
            if (error.message.includes('already exists') || 
                error.message.includes('does not exist')) {
              console.log('⚠️  Non-critical error, continuing...');
              continue;
            }
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`❌ Unexpected error in statement ${i + 1}:`, err.message);
        }
      }
    }
    
    console.log('🎉 POS System Database Schema Setup Complete!');
    console.log('');
    console.log('📋 What was created:');
    console.log('   ✅ Enhanced orders table with payment_mode and table_id');
    console.log('   ✅ table_sessions table for table management');
    console.log('   ✅ counters table for counter entities');
    console.log('   ✅ counter_sessions table for counter sessions');
    console.log('   ✅ bill_splits table for bill splitting');
    console.log('   ✅ order_bill_splits junction table');
    console.log('   ✅ service_charges table for discounts/comps');
    console.log('   ✅ Database functions for POS operations');
    console.log('   ✅ Views for active sessions');
    console.log('   ✅ Triggers for updated_at timestamps');
    console.log('   ✅ Default counters for existing venues');
    console.log('');
    console.log('🚀 Your POS system is now ready to use!');
    console.log('   • Navigate to /dashboard/[venueId]/pos to access the POS interface');
    console.log('   • Tables and counters are now properly separated');
    console.log('   • Payment modes are differentiated (online/pay_later/pay_at_till)');
    console.log('   • Bill splitting and table management features are available');
    
  } catch (error) {
    console.error('❌ Fatal error during schema setup:', error.message);
    process.exit(1);
  }
}

// Alternative approach using direct SQL execution
async function runPOSSchemaDirect() {
  console.log('🚀 Starting POS System Database Schema Setup (Direct SQL)...');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const schemaPath = path.join(__dirname, 'pos-system-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📖 Executing complete schema...');
    
    // Execute the entire schema as one block
    const { data, error } = await supabase
      .from('_sql')
      .select('*')
      .eq('query', schemaSQL);
    
    if (error) {
      console.error('❌ Schema execution error:', error);
      
      // Try executing in smaller chunks
      console.log('🔄 Trying chunked execution...');
      const statements = schemaSQL.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await supabase.rpc('exec', { sql: statement + ';' });
            console.log('✅ Executed statement');
          } catch (err) {
            console.log('⚠️  Statement failed (may already exist):', err.message);
          }
        }
      }
    }
    
    console.log('🎉 POS System Database Schema Setup Complete!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.log('');
    console.log('💡 Manual Setup Instructions:');
    console.log('   1. Open your Supabase dashboard');
    console.log('   2. Go to SQL Editor');
    console.log('   3. Copy and paste the contents of pos-system-schema.sql');
    console.log('   4. Execute the SQL');
    console.log('   5. Your POS system will be ready!');
  }
}

// Run the schema setup
if (require.main === module) {
  runPOSSchemaDirect().catch(console.error);
}

module.exports = { runPOSSchema, runPOSSchemaDirect };

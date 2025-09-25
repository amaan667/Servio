#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQL(sqlContent, description) {
  console.log(`📝 ${description}...`);
  
  try {
    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`   Executing: ${statement.substring(0, 50)}...`);
        const { data, error } = await supabase.rpc('exec', { sql: statement });
        
        if (error) {
          console.error(`❌ Error: ${error.message}`);
          return false;
        }
      }
    }
    
    console.log(`✅ ${description} completed successfully`);
    return true;
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Deploying staff soft deletion and forever count fixes...\n');
  console.log('📋 Please run the following SQL in your Supabase SQL Editor:\n');
  
  // Read SQL files
  const schemaUpdateSQL = fs.readFileSync(
    path.join(__dirname, 'scripts', 'update-staff-schema-soft-delete.sql'), 
    'utf8'
  );
  
  console.log('='.repeat(80));
  console.log('STEP 1: Copy and paste this SQL into your Supabase SQL Editor:');
  console.log('='.repeat(80));
  console.log(schemaUpdateSQL);
  console.log('='.repeat(80));
  
  console.log('\n📝 Instructions:');
  console.log('1. Go to your Supabase project dashboard');
  console.log('2. Click on "SQL Editor" in the left sidebar');
  console.log('3. Copy and paste the SQL above');
  console.log('4. Click "Run" to execute');
  console.log('\n✅ After running the SQL, your staff management will have:');
  console.log('   • No more flickering counts');
  console.log('   • Forever count for total staff (all staff ever added)');
  console.log('   • Soft deletion (staff are marked as deleted, not removed)');
}

main().catch(console.error);

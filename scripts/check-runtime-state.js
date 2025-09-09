#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRuntimeState() {
  try {
    console.log('🔍 Checking table_runtime_state view...');
    
    const { data: runtimeState, error } = await supabase
      .from('table_runtime_state')
      .select('*')
      .eq('venue_id', 'venue-1e02af4d')
      .order('label');

    if (error) {
      throw new Error(`Failed to fetch runtime state: ${error.message}`);
    }

    console.log(`📊 Found ${runtimeState.length} entries in table_runtime_state:`);
    
    // Group by label to see duplicates
    const grouped = {};
    runtimeState.forEach(table => {
      if (!grouped[table.label]) {
        grouped[table.label] = [];
      }
      grouped[table.label].push(table);
    });

    // Show all entries
    Object.entries(grouped).forEach(([label, tables]) => {
      console.log(`\n📍 Table: ${label} (${tables.length} entries)`);
      tables.forEach((table, index) => {
        console.log(`   ${index + 1}. ID: ${table.table_id}, Status: ${table.primary_status}, Session: ${table.session_id}`);
      });
    });

    // Check for duplicates
    const duplicates = Object.entries(grouped).filter(([_, tables]) => tables.length > 1);
    
    if (duplicates.length > 0) {
      console.log(`\n🚨 Found ${duplicates.length} duplicate table groups in runtime state:`);
      duplicates.forEach(([label, tables]) => {
        console.log(`   - Table ${label}: ${tables.length} duplicates`);
      });
    } else {
      console.log('\n✅ No duplicates found in runtime state');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRuntimeState();

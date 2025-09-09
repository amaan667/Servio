#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  try {
    console.log('🔍 Checking all tables in database...');
    
    const { data: tables, error } = await supabase
      .from('tables')
      .select('id, venue_id, label, created_at, is_active')
      .eq('is_active', true)
      .order('venue_id')
      .order('label')
      .order('created_at');

    if (error) {
      throw new Error(`Failed to fetch tables: ${error.message}`);
    }

    console.log(`📊 Found ${tables.length} active tables:`);
    
    // Group by venue_id and label
    const grouped = {};
    tables.forEach(table => {
      const key = `${table.venue_id}-${table.label}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(table);
    });

    // Show all tables
    Object.entries(grouped).forEach(([key, tables]) => {
      const [venueId, label] = key.split('-');
      console.log(`\n📍 Venue: ${venueId}, Table: ${label} (${tables.length} entries)`);
      tables.forEach((table, index) => {
        console.log(`   ${index + 1}. ID: ${table.id}, Created: ${table.created_at}`);
      });
    });

    // Check for duplicates
    const duplicates = Object.entries(grouped).filter(([_, tables]) => tables.length > 1);
    
    if (duplicates.length > 0) {
      console.log(`\n🚨 Found ${duplicates.length} duplicate table groups:`);
      duplicates.forEach(([key, tables]) => {
        console.log(`   - ${key}: ${tables.length} duplicates`);
      });
    } else {
      console.log('\n✅ No duplicates found in database');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTables();

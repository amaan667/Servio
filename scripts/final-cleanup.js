#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function finalCleanup() {
  try {
    console.log('🔍 Final cleanup - checking all related data...');
    
    // Let's check if there are any other tables that might be causing the duplication
    console.log('\n📊 Checking all tables in the database...');
    const { data: allTables, error: allTablesError } = await supabase
      .from('tables')
      .select('*')
      .eq('venue_id', 'venue-1e02af4d');

    if (allTablesError) {
      throw new Error(`Failed to fetch all tables: ${allTablesError.message}`);
    }

    console.log(`Found ${allTables.length} total tables (including inactive):`);
    allTables.forEach((table, index) => {
      console.log(`   ${index + 1}. ID: ${table.id}, Label: ${table.label}, Active: ${table.is_active}`);
    });

    // Check if there are any inactive tables that might be causing issues
    const inactiveTables = allTables.filter(t => !t.is_active);
    if (inactiveTables.length > 0) {
      console.log(`\n🗑️  Found ${inactiveTables.length} inactive tables, deleting them...`);
      
      const inactiveIds = inactiveTables.map(t => t.id);
      const { error: deleteError } = await supabase
        .from('tables')
        .delete()
        .in('id', inactiveIds);

      if (deleteError) {
        console.error('❌ Failed to delete inactive tables:', deleteError.message);
      } else {
        console.log(`✅ Deleted ${inactiveTables.length} inactive tables`);
      }
    }

    // Check if there are any other tables with the same label
    const tablesByLabel = {};
    allTables.forEach(table => {
      if (!tablesByLabel[table.label]) {
        tablesByLabel[table.label] = [];
      }
      tablesByLabel[table.label].push(table);
    });

    const duplicateLabels = Object.entries(tablesByLabel).filter(([_, tables]) => tables.length > 1);
    
    if (duplicateLabels.length > 0) {
      console.log(`\n🚨 Found duplicate table labels:`);
      duplicateLabels.forEach(([label, tables]) => {
        console.log(`   - Label "${label}": ${tables.length} tables`);
        tables.forEach((table, index) => {
          console.log(`     ${index + 1}. ID: ${table.id}, Active: ${table.is_active}, Created: ${table.created_at}`);
        });
      });

      // Keep only the oldest active table for each label
      console.log('\n🗑️  Removing duplicate table labels (keeping oldest active)...');
      for (const [label, tables] of duplicateLabels) {
        const activeTables = tables.filter(t => t.is_active);
        if (activeTables.length > 1) {
          const sorted = activeTables.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          const toDelete = sorted.slice(1);
          
          console.log(`   Keeping table ${sorted[0].id} for label "${label}"`);
          for (const table of toDelete) {
            console.log(`   Deleting table ${table.id} for label "${label}"`);
            const { error: deleteError } = await supabase
              .from('tables')
              .delete()
              .eq('id', table.id);
            
            if (deleteError) {
              console.error(`   ❌ Failed to delete table ${table.id}:`, deleteError.message);
            } else {
              console.log(`   ✅ Deleted table ${table.id}`);
            }
          }
        }
      }
    }

    console.log('\n✅ Final cleanup complete! Check your dashboard now.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

finalCleanup();

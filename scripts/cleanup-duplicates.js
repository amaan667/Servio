#!/usr/bin/env node

/**
 * Cleanup Duplicate Tables Script
 * 
 * This script connects to your Supabase database and removes duplicate tables,
 * keeping only the oldest one for each table number per venue.
 * 
 * Usage: node scripts/cleanup-duplicates.js
 */

const { createClient } = require('@supabase/supabase-js');
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

async function cleanupDuplicates() {
  try {
    console.log('🔍 Checking for duplicate tables...');
    
    // First, let's see what duplicates we have
    const { data: duplicates, error: duplicatesError } = await supabase
      .from('tables')
      .select('venue_id, label, id, created_at')
      .eq('is_active', true)
      .order('venue_id')
      .order('label')
      .order('created_at');

    if (duplicatesError) {
      throw new Error(`Failed to fetch tables: ${duplicatesError.message}`);
    }

    // Group by venue_id and label to find duplicates
    const grouped = {};
    duplicates.forEach(table => {
      const key = `${table.venue_id}-${table.label}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(table);
    });

    // Find duplicates
    const duplicatesToRemove = [];
    Object.values(grouped).forEach(tables => {
      if (tables.length > 1) {
        // Sort by created_at, keep the oldest (first), remove the rest
        const sorted = tables.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        for (let i = 1; i < sorted.length; i++) {
          duplicatesToRemove.push(sorted[i].id);
        }
      }
    });

    if (duplicatesToRemove.length === 0) {
      console.log('✅ No duplicate tables found!');
      return;
    }

    console.log(`🗑️  Found ${duplicatesToRemove.length} duplicate tables to remove:`);
    
    // Show what we're about to delete
    const { data: tablesToDelete } = await supabase
      .from('tables')
      .select('id, venue_id, label, created_at')
      .in('id', duplicatesToRemove)
      .order('venue_id')
      .order('label')
      .order('created_at');

    tablesToDelete?.forEach(table => {
      console.log(`   - Table ${table.label} in venue ${table.venue_id} (created: ${table.created_at})`);
    });

    // Delete the duplicate tables
    console.log('\n🗑️  Deleting duplicate tables...');
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .in('id', duplicatesToRemove);

    if (deleteError) {
      throw new Error(`Failed to delete duplicate tables: ${deleteError.message}`);
    }

    console.log(`✅ Successfully deleted ${duplicatesToRemove.length} duplicate tables!`);

    // Clean up orphaned table_sessions
    console.log('\n🧹 Cleaning up orphaned table sessions...');
    const { error: sessionCleanupError } = await supabase
      .from('table_sessions')
      .delete()
      .not('table_id', 'in', `(SELECT id FROM tables WHERE is_active = true)`);

    if (sessionCleanupError) {
      console.warn(`⚠️  Warning: Failed to clean up orphaned sessions: ${sessionCleanupError.message}`);
    } else {
      console.log('✅ Orphaned table sessions cleaned up!');
    }

    // Verify the cleanup
    console.log('\n🔍 Verifying cleanup...');
    const { data: remainingTables } = await supabase
      .from('tables')
      .select('venue_id, label')
      .eq('is_active', true)
      .order('venue_id')
      .order('label');

    const remainingGrouped = {};
    remainingTables?.forEach(table => {
      const key = `${table.venue_id}-${table.label}`;
      remainingGrouped[key] = (remainingGrouped[key] || 0) + 1;
    });

    const stillDuplicates = Object.entries(remainingGrouped).filter(([_, count]) => count > 1);
    
    if (stillDuplicates.length > 0) {
      console.log('⚠️  Warning: Some duplicates may still exist:');
      stillDuplicates.forEach(([key, count]) => {
        console.log(`   - ${key}: ${count} tables`);
      });
    } else {
      console.log('✅ Cleanup successful! No duplicate tables remain.');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
cleanupDuplicates();

#!/usr/bin/env node

// Test script to check menu items visibility and RLS policies
// This will help diagnose why PDF-processed items aren't showing up in the menu management interface

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!supabaseAnonKey);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

// Create clients
const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

async function testMenuItemsVisibility() {
  console.log('🔍 Testing Menu Items Visibility and RLS Policies\n');

  try {
    // Step 1: Check RLS status on menu_items table
    console.log('1️⃣ Checking RLS status on menu_items table...');
    const { data: rlsStatus, error: rlsError } = await serviceClient
      .from('information_schema.tables')
      .select('table_name, row_security')
      .eq('table_name', 'menu_items')
      .eq('table_schema', 'public')
      .single();

    if (rlsError) {
      console.error('❌ Failed to check RLS status:', rlsError.message);
    } else {
      console.log('✅ RLS Status:', rlsStatus);
    }

    // Step 2: Check RLS policies on menu_items table
    console.log('\n2️⃣ Checking RLS policies on menu_items table...');
    const { data: policies, error: policiesError } = await serviceClient
      .from('pg_policies')
      .select('policyname, permissive, roles, cmd')
      .eq('tablename', 'menu_items')
      .eq('schemaname', 'public');

    if (policiesError) {
      console.error('❌ Failed to check RLS policies:', policiesError.message);
    } else {
      console.log('✅ RLS Policies found:', policies.length);
      policies.forEach(policy => {
        console.log(`   - ${policy.policyname}: ${policy.cmd} for ${policy.roles.join(', ')}`);
      });
    }

    // Step 3: Check total menu items count (service role should see all)
    console.log('\n3️⃣ Checking total menu items count (service role)...');
    const { data: totalCount, error: countError } = await serviceClient
      .from('menu_items')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Failed to get total count:', countError.message);
    } else {
      console.log('✅ Total menu items in database:', totalCount);
    }

    // Step 4: Check menu items by venue (service role)
    console.log('\n4️⃣ Checking menu items by venue (service role)...');
    const { data: venueItems, error: venueError } = await serviceClient
      .from('menu_items')
      .select('venue_id, COUNT(*)')
      .group('venue_id')
      .order('venue_id');

    if (venueError) {
      console.error('❌ Failed to get venue items:', venueError.message);
    } else {
      console.log('✅ Menu items by venue:');
      venueItems.forEach(item => {
        console.log(`   - ${item.venue_id}: ${item.count} items`);
      });
    }

    // Step 5: Check recent menu items (service role)
    console.log('\n5️⃣ Checking recent menu items (service role)...');
    const { data: recentItems, error: recentError } = await serviceClient
      .from('menu_items')
      .select('id, venue_id, name, category, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('❌ Failed to get recent items:', recentError.message);
    } else {
      console.log('✅ Recent menu items:');
      recentItems.forEach(item => {
        console.log(`   - ${item.name} (${item.category}) - ${item.venue_id} - ${item.created_at}`);
      });
    }

    // Step 6: Test anon client access (should be restricted by RLS)
    console.log('\n6️⃣ Testing anon client access (should be restricted by RLS)...');
    const { data: anonItems, error: anonError } = await anonClient
      .from('menu_items')
      .select('*')
      .limit(5);

    if (anonError) {
      console.log('✅ Anon client properly restricted:', anonError.message);
    } else {
      console.log('⚠️  Anon client can see items (RLS might not be working):', anonItems?.length || 0);
    }

    // Step 7: Check if there are any menu items with recent timestamps
    console.log('\n7️⃣ Checking for recent menu item insertions...');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentInsertions, error: insertionError } = await serviceClient
      .from('menu_items')
      .select('id, venue_id, name, category, created_at')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false });

    if (insertionError) {
      console.error('❌ Failed to check recent insertions:', insertionError.message);
    } else {
      console.log('✅ Menu items inserted in the last hour:', recentInsertions.length);
      if (recentInsertions.length > 0) {
        console.log('   Recent items:');
        recentInsertions.forEach(item => {
          console.log(`     - ${item.name} (${item.category}) - ${item.venue_id} - ${item.created_at}`);
        });
      }
    }

    // Step 8: Check venues table to understand venue_id format
    console.log('\n8️⃣ Checking venues table structure...');
    const { data: venues, error: venuesError } = await serviceClient
      .from('venues')
      .select('venue_id, name, owner_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (venuesError) {
      console.error('❌ Failed to get venues:', venuesError.message);
    } else {
      console.log('✅ Venues found:', venues.length);
      venues.forEach(venue => {
        console.log(`   - ${venue.venue_id}: ${venue.name} (owner: ${venue.owner_id})`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testMenuItemsVisibility()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

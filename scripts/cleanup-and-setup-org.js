#!/usr/bin/env node

// Cleanup Users and Setup Organization
// This script removes all users except amaantanveer667@gmail.com and sets up proper organization

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Environment variables check:');
console.log('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
console.log('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('   Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🚀 Starting user cleanup and organization setup...\n');

  try {
    // Step 1: Get current state
    console.log('📊 Current state:');
    
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;
    
    console.log(`   Users: ${users.users.length}`);
    users.users.forEach(user => {
      console.log(`     - ${user.email} (${user.id})`);
    });

    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, owner_id, subscription_tier, subscription_status');
    if (orgsError) throw orgsError;
    
    console.log(`   Organizations: ${orgs.length}`);
    orgs.forEach(org => {
      console.log(`     - ${org.name} (${org.id})`);
    });

    const { data: venues, error: venuesError } = await supabase
      .from('venues')
      .select('venue_id, name, owner_id, organization_id');
    if (venuesError) throw venuesError;
    
    console.log(`   Venues: ${venues.length}`);
    venues.forEach(venue => {
      console.log(`     - ${venue.name} (${venue.venue_id})`);
    });

    // Step 2: Find target user
    const targetUser = users.users.find(user => user.email === 'amaantanveer667@gmail.com');
    if (!targetUser) {
      throw new Error('Target user amaantanveer667@gmail.com not found!');
    }
    
    console.log(`\n🎯 Target user found: ${targetUser.email} (${targetUser.id})\n`);

    // Step 3: Clean up data from other users
    console.log('🧹 Cleaning up data from other users...');
    
    const otherUserIds = users.users
      .filter(user => user.email !== 'amaantanveer667@gmail.com')
      .map(user => user.id);

    if (otherUserIds.length > 0) {
      console.log(`   Removing data for ${otherUserIds.length} other users...`);
      
      // Delete orders from other users' venues
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .in('venue_id', 
          await supabase
            .from('venues')
            .select('venue_id')
            .in('owner_id', otherUserIds)
            .then(({ data }) => data?.map(v => v.venue_id) || [])
        );
      if (ordersError) console.warn('   ⚠️  Error deleting orders:', ordersError.message);

      // Delete menu items from other users' venues
      const { error: menuError } = await supabase
        .from('menu_items')
        .delete()
        .in('venue_id',
          await supabase
            .from('venues')
            .select('venue_id')
            .in('owner_id', otherUserIds)
            .then(({ data }) => data?.map(v => v.venue_id) || [])
        );
      if (menuError) console.warn('   ⚠️  Error deleting menu items:', menuError.message);

      // Delete tables from other users' venues
      const { error: tablesError } = await supabase
        .from('tables')
        .delete()
        .in('venue_id',
          await supabase
            .from('venues')
            .select('venue_id')
            .in('owner_id', otherUserIds)
            .then(({ data }) => data?.map(v => v.venue_id) || [])
        );
      if (tablesError) console.warn('   ⚠️  Error deleting tables:', tablesError.message);

      // Delete user venue roles from other users
      const { error: rolesError } = await supabase
        .from('user_venue_roles')
        .delete()
        .in('user_id', otherUserIds);
      if (rolesError) console.warn('   ⚠️  Error deleting user venue roles:', rolesError.message);

      // Delete venues from other users
      const { error: venuesError2 } = await supabase
        .from('venues')
        .delete()
        .in('owner_id', otherUserIds);
      if (venuesError2) console.warn('   ⚠️  Error deleting venues:', venuesError2.message);

      // Delete organizations from other users
      const { error: orgsError2 } = await supabase
        .from('organizations')
        .delete()
        .in('owner_id', otherUserIds);
      if (orgsError2) console.warn('   ⚠️  Error deleting organizations:', orgsError2.message);

      // Delete other users
      for (const userId of otherUserIds) {
        const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
        if (deleteUserError) {
          console.warn(`   ⚠️  Error deleting user ${userId}:`, deleteUserError.message);
        } else {
          console.log(`   ✅ Deleted user ${userId}`);
        }
      }
    } else {
      console.log('   ✅ No other users to remove');
    }

    // Step 4: Set up organization for target user
    console.log('\n🏢 Setting up organization for target user...');
    
    const { data: existingOrg, error: existingOrgError } = await supabase
      .from('organizations')
      .select('id, name, subscription_tier, subscription_status')
      .eq('owner_id', targetUser.id)
      .single();

    if (existingOrgError && existingOrgError.code !== 'PGRST116') {
      throw existingOrgError;
    }

    if (existingOrg) {
      console.log(`   ✅ Organization already exists: ${existingOrg.name} (${existingOrg.id})`);
      console.log(`      Tier: ${existingOrg.subscription_tier}, Status: ${existingOrg.subscription_status}`);
    } else {
      // Create new organization
      const { data: newOrg, error: createOrgError } = await supabase
        .from('organizations')
        .insert({
          name: 'Servio Demo Organization',
          slug: 'servio-demo-org',
          owner_id: targetUser.id,
          subscription_tier: 'basic',
          subscription_status: 'active',
          is_grandfathered: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createOrgError) throw createOrgError;
      
      console.log(`   ✅ Created new organization: ${newOrg.name} (${newOrg.id})`);
    }

    // Step 5: Update venues to reference organization
    console.log('\n🏪 Updating venues to reference organization...');
    
    const { data: userOrg, error: userOrgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', targetUser.id)
      .single();
    
    if (userOrgError) throw userOrgError;

    const { data: userVenues, error: userVenuesError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('owner_id', targetUser.id);
    
    if (userVenuesError) throw userVenuesError;

    for (const venue of userVenues || []) {
      const { error: updateVenueError } = await supabase
        .from('venues')
        .update({ organization_id: userOrg.id })
        .eq('venue_id', venue.venue_id);
      
      if (updateVenueError) {
        console.warn(`   ⚠️  Error updating venue ${venue.name}:`, updateVenueError.message);
      } else {
        console.log(`   ✅ Updated venue: ${venue.name}`);
      }
    }

    // Step 6: Create user venue roles
    console.log('\n👥 Setting up user venue roles...');
    
    for (const venue of userVenues || []) {
      const { error: roleError } = await supabase
        .from('user_venue_roles')
        .upsert({
          user_id: targetUser.id,
          venue_id: venue.venue_id,
          organization_id: userOrg.id,
          role: 'owner',
          permissions: { all: true }
        }, {
          onConflict: 'user_id,venue_id'
        });
      
      if (roleError) {
        console.warn(`   ⚠️  Error creating role for venue ${venue.name}:`, roleError.message);
      } else {
        console.log(`   ✅ Created owner role for venue: ${venue.name}`);
      }
    }

    // Step 7: Final verification
    console.log('\n✅ Final verification:');
    
    const { data: finalUsers, error: finalUsersError } = await supabase.auth.admin.listUsers();
    if (finalUsersError) throw finalUsersError;
    
    console.log(`   Users: ${finalUsers.users.length}`);
    finalUsers.users.forEach(user => {
      console.log(`     - ${user.email} (${user.id})`);
    });

    const { data: finalOrgs, error: finalOrgsError } = await supabase
      .from('organizations')
      .select('id, name, owner_id, subscription_tier, subscription_status');
    if (finalOrgsError) throw finalOrgsError;
    
    console.log(`   Organizations: ${finalOrgs.length}`);
    finalOrgs.forEach(org => {
      console.log(`     - ${org.name} (${org.id})`);
    });

    const { data: finalVenues, error: finalVenuesError } = await supabase
      .from('venues')
      .select('venue_id, name, owner_id, organization_id');
    if (finalVenuesError) throw finalVenuesError;
    
    console.log(`   Venues: ${finalVenues.length}`);
    finalVenues.forEach(venue => {
      console.log(`     - ${venue.name} (${venue.venue_id}) - Org: ${venue.organization_id}`);
    });

    const { data: finalRoles, error: finalRolesError } = await supabase
      .from('user_venue_roles')
      .select('user_id, venue_id, organization_id, role');
    if (finalRolesError) throw finalRolesError;
    
    console.log(`   User Venue Roles: ${finalRoles.length}`);
    finalRoles.forEach(role => {
      console.log(`     - User: ${role.user_id}, Venue: ${role.venue_id}, Role: ${role.role}`);
    });

    console.log('\n🎉 Cleanup and organization setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test the homepage subscription display');
    console.log('   2. Test the dashboard subscription display');
    console.log('   3. Try upgrading to Standard plan');
    console.log('   4. Verify both pages update correctly after checkout');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

main();

#!/usr/bin/env node

/**
 * Daily Reset Fix Script
 * 
 * This script helps fix the daily reset system by:
 * 1. Adding the missing daily_reset_time column to venues table
 * 2. Setting default reset times for existing venues
 * 3. Testing the reset functionality
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkColumnExists() {
  console.log('🔍 Checking if daily_reset_time column exists...');
  
  try {
    const { data, error } = await supabase
      .from('venues')
      .select('daily_reset_time')
      .limit(1);
    
    if (error && error.message.includes('column "daily_reset_time" does not exist')) {
      console.log('❌ Column daily_reset_time does not exist');
      return false;
    } else if (error) {
      console.error('❌ Error checking column:', error.message);
      return false;
    }
    
    console.log('✅ Column daily_reset_time exists');
    return true;
  } catch (error) {
    console.error('❌ Error checking column:', error.message);
    return false;
  }
}

async function addColumn() {
  console.log('🔧 Adding daily_reset_time column...');
  
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'venues' 
                AND column_name = 'daily_reset_time'
                AND table_schema = 'public'
            ) THEN
                ALTER TABLE venues ADD COLUMN daily_reset_time TIME;
                RAISE NOTICE 'Added daily_reset_time column to venues table';
            ELSE
                RAISE NOTICE 'daily_reset_time column already exists in venues table';
            END IF;
        END $$;
      `
    });
    
    if (error) {
      console.error('❌ Error adding column:', error.message);
      return false;
    }
    
    console.log('✅ Column added successfully');
    return true;
  } catch (error) {
    console.error('❌ Error adding column:', error.message);
    return false;
  }
}

async function setDefaultResetTimes() {
  console.log('🕐 Setting default reset times for existing venues...');
  
  try {
    const { error } = await supabase
      .from('venues')
      .update({ daily_reset_time: '00:00:00' })
      .is('daily_reset_time', null);
    
    if (error) {
      console.error('❌ Error setting default times:', error.message);
      return false;
    }
    
    console.log('✅ Default reset times set');
    return true;
  } catch (error) {
    console.error('❌ Error setting default times:', error.message);
    return false;
  }
}

async function testResetEndpoint() {
  console.log('🧪 Testing reset endpoint...');
  
  try {
    const response = await fetch(`${process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000'}/api/cron/daily-reset`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'default-cron-secret'}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Reset endpoint working:', result.message);
      return true;
    } else {
      console.error('❌ Reset endpoint failed:', response.status, await response.text());
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing endpoint:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Daily Reset Fix...\n');
  
  // Step 1: Check if column exists
  const columnExists = await checkColumnExists();
  
  if (!columnExists) {
    // Step 2: Add column
    const columnAdded = await addColumn();
    if (!columnAdded) {
      console.error('❌ Failed to add column. Please run the SQL manually.');
      process.exit(1);
    }
  }
  
  // Step 3: Set default reset times
  const timesSet = await setDefaultResetTimes();
  if (!timesSet) {
    console.error('❌ Failed to set default times.');
    process.exit(1);
  }
  
  // Step 4: Test endpoint
  const endpointWorking = await testResetEndpoint();
  if (!endpointWorking) {
    console.log('⚠️  Reset endpoint test failed. Check your CRON_SECRET environment variable.');
  }
  
  console.log('\n✅ Daily Reset Fix Complete!');
  console.log('\nNext steps:');
  console.log('1. Set CRON_SECRET environment variable in Railway');
  console.log('2. Verify your venues have reset times set');
  console.log('3. Test the manual reset endpoint');
  console.log('4. Monitor the cron job logs');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkColumnExists, addColumn, setDefaultResetTimes, testResetEndpoint };
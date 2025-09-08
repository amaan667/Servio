#!/usr/bin/env node

// Simple script to check staff tables
const { createClient } = require('@supabase/supabase-js');

async function checkStaffTables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables:');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'MISSING');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Checking staff table...');
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .limit(5);

    if (staffError) {
      console.error('Staff table error:', staffError.message);
    } else {
      console.log('Staff table exists, found', staff?.length || 0, 'members');
      if (staff && staff.length > 0) {
        console.log('Sample staff:', staff[0]);
      }
    }

    console.log('\nChecking staff_shifts table...');
    const { data: shifts, error: shiftsError } = await supabase
      .from('staff_shifts')
      .select('*')
      .limit(5);

    if (shiftsError) {
      console.error('Staff shifts table error:', shiftsError.message);
    } else {
      console.log('Staff shifts table exists, found', shifts?.length || 0, 'shifts');
      if (shifts && shifts.length > 0) {
        console.log('Sample shift:', shifts[0]);
      }
    }

    // Check if there are any shifts without matching staff
    if (shifts && shifts.length > 0 && staff && staff.length > 0) {
      console.log('\nChecking for orphaned shifts...');
      const orphanedShifts = shifts.filter(shift => 
        !staff.find(s => s.id === shift.staff_id)
      );
      console.log('Orphaned shifts (no matching staff):', orphanedShifts.length);
      if (orphanedShifts.length > 0) {
        console.log('Sample orphaned shift:', orphanedShifts[0]);
      }
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkStaffTables();

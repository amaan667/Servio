// Fix the current merged table by properly unmerging it
// This script will restore the original table names

const { createClient } = require('@supabase/supabase-js');

async function fixCurrentMergedTable() {
  console.log('🔧 Fixing current merged table...');
  
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
    console.log('📊 Getting current merged table state...');
    
    // Get the primary table (with + in label)
    const { data: primaryTable, error: primaryError } = await supabase
      .from('tables')
      .select('id, label, seat_count, venue_id')
      .like('label', '%+%')
      .single();
    
    if (primaryError) {
      console.error('❌ Error fetching primary table:', primaryError);
      return;
    }
    
    console.log('📋 Primary table:', primaryTable);
    
    // Get the secondary table (with merged_with_table_id)
    const { data: secondaryTable, error: secondaryError } = await supabase
      .from('tables')
      .select('id, label, seat_count, merged_with_table_id, venue_id')
      .eq('merged_with_table_id', primaryTable.id)
      .single();
    
    if (secondaryError) {
      console.error('❌ Error fetching secondary table:', secondaryError);
      return;
    }
    
    console.log('📋 Secondary table:', secondaryTable);
    
    // Parse the merged label to get original names
    const mergedLabel = primaryTable.label; // "9+99"
    const parts = mergedLabel.split('+');
    const originalName1 = parts[0].trim(); // "9"
    const originalName2 = parts[1].trim(); // "99"
    
    console.log(`📋 Parsed original names: "${originalName1}" and "${originalName2}"`);
    
    // Restore primary table to original name
    console.log('🔧 Restoring primary table...');
    const { error: updatePrimaryError } = await supabase
      .from('tables')
      .update({
        label: originalName1,
        seat_count: 2,
        updated_at: new Date().toISOString()
      })
      .eq('id', primaryTable.id);
    
    if (updatePrimaryError) {
      console.error('❌ Error updating primary table:', updatePrimaryError);
      return;
    }
    
    // Restore secondary table to original name and unmerge
    console.log('🔧 Restoring secondary table...');
    const { error: updateSecondaryError } = await supabase
      .from('tables')
      .update({
        label: originalName2,
        seat_count: 2,
        merged_with_table_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', secondaryTable.id);
    
    if (updateSecondaryError) {
      console.error('❌ Error updating secondary table:', updateSecondaryError);
      return;
    }
    
    // Close the OCCUPIED session for secondary table
    console.log('🔧 Closing secondary table session...');
    const { error: closeSessionError } = await supabase
      .from('table_sessions')
      .update({
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('table_id', secondaryTable.id)
      .eq('status', 'OCCUPIED')
      .is('closed_at', null);
    
    if (closeSessionError) {
      console.error('❌ Error closing secondary session:', closeSessionError);
      return;
    }
    
    // Create new FREE session for secondary table
    console.log('🔧 Creating new FREE session for secondary table...');
    const { error: createSessionError } = await supabase
      .from('table_sessions')
      .insert({
        table_id: secondaryTable.id,
        venue_id: secondaryTable.venue_id,
        status: 'FREE',
        opened_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (createSessionError) {
      console.error('❌ Error creating new session:', createSessionError);
      return;
    }
    
    console.log('✅ Successfully unmerged tables!');
    console.log(`📋 Primary table "${primaryTable.label}" restored to "${originalName1}"`);
    console.log(`📋 Secondary table "${secondaryTable.label}" restored to "${originalName2}"`);
    console.log('🎯 Both tables are now separate with 2 seats each');
    
  } catch (error) {
    console.error('❌ Fatal error during fix:', error.message);
  }
}

// Run the fix
if (require.main === module) {
  fixCurrentMergedTable().catch(console.error);
}

module.exports = { fixCurrentMergedTable };

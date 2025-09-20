// Fix the table label to restore original name
// This script will change "9+99" back to "9"

const { createClient } = require('@supabase/supabase-js');

async function fixTableLabel() {
  console.log('🔧 Fixing table label...');
  
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
    console.log('📊 Getting table with + in label...');
    
    // Get the table with + in label
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('id, label, seat_count, venue_id')
      .like('label', '%+%')
      .single();
    
    if (tableError) {
      console.error('❌ Error fetching table:', tableError);
      return;
    }
    
    console.log('📋 Current table:', table);
    
    // Parse the label to get the first part (original name)
    const mergedLabel = table.label; // "9+99"
    const originalName = mergedLabel.split('+')[0].trim(); // "9"
    
    console.log(`📋 Original name should be: "${originalName}"`);
    
    // Update the table label to the original name
    console.log('🔧 Updating table label...');
    const { error: updateError } = await supabase
      .from('tables')
      .update({
        label: originalName,
        updated_at: new Date().toISOString()
      })
      .eq('id', table.id);
    
    if (updateError) {
      console.error('❌ Error updating table label:', updateError);
      return;
    }
    
    console.log(`✅ Successfully updated table label from "${table.label}" to "${originalName}"`);
    console.log('🎯 Table is now restored to its original state');
    
  } catch (error) {
    console.error('❌ Fatal error during fix:', error.message);
  }
}

// Run the fix
if (require.main === module) {
  fixTableLabel().catch(console.error);
}

module.exports = { fixTableLabel };

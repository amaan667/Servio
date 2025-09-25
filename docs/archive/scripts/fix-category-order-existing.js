const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCategoryOrderForExistingVenue() {
  const venueId = 'venue-1e02af4d';
  
  try {
    console.log('Fetching current menu items...');
    
    // Get current menu items to derive the correct category order
    const { data: menuItems, error: itemsError } = await supabase
      .from('menu_items')
      .select('id, name, category, price')
      .eq('venue_id', venueId)
      .order('id', { ascending: true }); // Order by ID to get the original PDF order

    if (itemsError) {
      console.error('Error fetching menu items:', itemsError);
      return;
    }

    console.log(`Found ${menuItems.length} menu items`);

    // Derive category order from the order items appear in the database
    const categoryFirstAppearance = {};
    menuItems.forEach((item, index) => {
      const category = item.category || 'Uncategorized';
      if (!(category in categoryFirstAppearance)) {
        categoryFirstAppearance[category] = index;
      }
    });

    // Sort categories by their first appearance (PDF order)
    const correctCategoryOrder = Object.keys(categoryFirstAppearance).sort((a, b) => 
      categoryFirstAppearance[a] - categoryFirstAppearance[b]
    );

    console.log('Derived correct category order:', correctCategoryOrder);

    // Update the most recent menu upload with the correct category order
    const { data: uploads, error: fetchError } = await supabase
      .from('menu_uploads')
      .select('id, venue_id, created_at, category_order')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Error fetching menu uploads:', fetchError);
      return;
    }

    if (!uploads || uploads.length === 0) {
      console.log('No menu uploads found for this venue');
      return;
    }

    const latestUpload = uploads[0];
    console.log('Found latest upload:', latestUpload.id);

    // Update the category order
    const { data: updateData, error: updateError } = await supabase
      .from('menu_uploads')
      .update({ 
        category_order: correctCategoryOrder,
        parsed_json: {
          ...latestUpload.parsed_json,
          categories: correctCategoryOrder
        }
      })
      .eq('id', latestUpload.id)
      .select();

    if (updateError) {
      console.error('Error updating category order:', updateError);
      return;
    }

    console.log('Successfully updated category order!');
    console.log('New category order:', correctCategoryOrder);
    
    // Verify the update
    const { data: verifyData, error: verifyError } = await supabase
      .from('menu_uploads')
      .select('venue_id, category_order, created_at')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (verifyError) {
      console.error('Error verifying update:', verifyError);
      return;
    }

    console.log('Verified update:', verifyData[0]);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

fixCategoryOrderForExistingVenue();

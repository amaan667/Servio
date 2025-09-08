#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeMenuIssues() {
  console.log('🔍 Analyzing Menu Issues\n');

  try {
    // 1. Get category counts
    console.log('1️⃣ Category counts:');
    const { data: categoryCounts, error: catError } = await supabase
      .from('menu_items')
      .select('category')
      .not('category', 'is', null);

    if (catError) {
      console.error('❌ Error getting categories:', catError.message);
      return;
    }

    const categoryMap = {};
    categoryCounts.forEach(item => {
      const cat = item.category || 'NULL';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });

    Object.entries(categoryMap)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count} items`);
      });

    // 2. Find items with £0.00 prices
    console.log('\n2️⃣ Items with £0.00 prices:');
    const { data: zeroPriceItems, error: zeroError } = await supabase
      .from('menu_items')
      .select('name, category, price')
      .eq('price', 0);

    if (zeroError) {
      console.error('❌ Error getting zero price items:', zeroError.message);
    } else {
      zeroPriceItems.forEach(item => {
        console.log(`   "${item.name}" (${item.category}) - £${item.price}`);
      });
    }

    // 3. Find "Coffee with a shot of" items (modifier explosion)
    console.log('\n3️⃣ "Coffee with a shot of" items (modifier explosion):');
    const { data: coffeeShotItems, error: coffeeError } = await supabase
      .from('menu_items')
      .select('name, category, price')
      .ilike('name', '%coffee with a shot of%');

    if (coffeeError) {
      console.error('❌ Error getting coffee shot items:', coffeeError.message);
    } else {
      console.log(`   Found ${coffeeShotItems.length} items:`);
      coffeeShotItems.slice(0, 10).forEach(item => {
        console.log(`   "${item.name}" (${item.category}) - £${item.price}`);
      });
      if (coffeeShotItems.length > 10) {
        console.log(`   ... and ${coffeeShotItems.length - 10} more`);
      }
    }

    // 4. Find misfiled items (lobster in coffee)
    console.log('\n4️⃣ Misfiled items (lobster in coffee):');
    const { data: lobsterItems, error: lobsterError } = await supabase
      .from('menu_items')
      .select('name, category, price')
      .ilike('name', '%lobster%')
      .eq('category', 'COFFEE');

    if (lobsterError) {
      console.error('❌ Error getting lobster items:', lobsterError.message);
    } else {
      lobsterItems.forEach(item => {
        console.log(`   "${item.name}" (${item.category}) - £${item.price}`);
      });
    }

    // 5. Find duplicates/near-duplicates
    console.log('\n5️⃣ Potential duplicates (same name, different prices):');
    const { data: allItems, error: allError } = await supabase
      .from('menu_items')
      .select('name, price, category')
      .order('name');

    if (allError) {
      console.error('❌ Error getting all items:', allError.message);
    } else {
      const nameMap = {};
      allItems.forEach(item => {
        const normalizedName = item.name.toLowerCase().trim();
        if (!nameMap[normalizedName]) {
          nameMap[normalizedName] = [];
        }
        nameMap[normalizedName].push(item);
      });

      Object.entries(nameMap)
        .filter(([, items]) => items.length > 1)
        .slice(0, 10)
        .forEach(([name, items]) => {
          console.log(`   "${name}":`);
          items.forEach(item => {
            console.log(`     - £${item.price} (${item.category})`);
          });
        });
    }

    // 6. Find truncated descriptions
    console.log('\n6️⃣ Items with truncated descriptions (containing "granular"):');
    const { data: truncatedItems, error: truncError } = await supabase
      .from('menu_items')
      .select('name, description, category')
      .ilike('description', '%granular%');

    if (truncError) {
      console.error('❌ Error getting truncated items:', truncError.message);
    } else {
      truncatedItems.forEach(item => {
        console.log(`   "${item.name}" (${item.category}): "${item.description}"`);
      });
    }

    // 7. Find component items (club sandwich, etc.)
    console.log('\n7️⃣ Component items (club sandwich, mini, wraps):');
    const { data: componentItems, error: compError } = await supabase
      .from('menu_items')
      .select('name, category, price')
      .or('name.ilike.%club sandwich%,name.ilike.%mini%,name.ilike.%wraps%');

    if (compError) {
      console.error('❌ Error getting component items:', compError.message);
    } else {
      componentItems.forEach(item => {
        console.log(`   "${item.name}" (${item.category}) - £${item.price}`);
      });
    }

    console.log('\n✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

analyzeMenuIssues();

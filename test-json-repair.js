#!/usr/bin/env node

/**
 * Test script for JSON repair functionality
 * Demonstrates fixing the broken JSON from the user's example
 */

// The broken JSON from the user's example
const brokenJSON = `{
  "items": [
    {
      "title": "Labneh",
      "category": "STARTERS",
      "price": 4.50,
      "price": 10.50,
      "description": "Cream Olive Cheese traditional dip. Served with olives and zaatar."
      "description": "Served with overnight oat, granular, milk macerated berries, greek yoghurt, greek honey."
    },
    },
    {
    {
      "title": "Kibbeh",
    {
      "title": "Chicken Burger",
      "category": "STARTERS",
      "category": "MAINS",
      "title": "Mini Turkish Kids Breakfast",
      "price": 5.50,
      "price": 8.00,
      "description": "Crushed wheat mixture with minced meat, deep fried."
      "category": "KIDS",
    },
      "price": 7.00,
    {
      "description": "1 sausage, 1 egg, toast, jam, beans, cucumber, 1 hash brown. 12 years max."
      "title": "Mutbal",
    },
      "category": "STARTERS",
    {
      "price": 7.00,
      "title": "Kids Burgers Chicken or Beef",
      "description": "Smoked aubergine, yoghurt, tahini, lemon, served with bread."
      "category": "KIDS",
    },
      "price": 8.00,
    {
      "description": "One mini chicken or beef burger with fries."
      "title": "Grilled Halloumi",
    },
      "category": "STARTERS",
    {
      "price": 7.00,
      "title": "Matcha Yogurt Bowl",
      "description": "Grilled Halloumi served with fresh salad and Nur Sauce."
      "category": "BRUNCH",
    },
      "price": 6.50,
    {
      "description": "Matcha yoghurt, honey, granola, banana, kiwi, strawberries, blueberries, cacao nibs."
      "title": "Houmous",
    },
      "category": "STARTERS",
    {
      "title": "Nutty Granola",
      "price": 7.00,
      "category": "BRUNCH",
      "description": "Homemade Houmous, Pita bread, Olive oil."
    },
    {
      "title": "Baba Ghanoush",
      "category": "STARTERS",
      "price": 7.95,
      "description": "Tomato, parsley, onion, tahini, garlic with Lebanese bread."
    },
    {
      "title": "Soup of the Day",
      "category": "STARTERS",
      "price": 7.50,
      "description": "Ask your waitress. Served with 2X pieces of sourdough."
    },
    {
      "title": "Cheese Bourak",
      "category": "STARTERS",
      "price": 6.50,
      "description": "Stuffed bourak with cheese."
    },
    {
      "title": "Meat Bourak"`;

async function testJSONRepair() {
  console.log('🔧 Testing JSON Repair System');
  console.log('=============================');
  
  try {
    // Import the repair functions
    const { repairAndValidateMenuJSON, validateMenuJSON } = await import('./lib/pdfImporter/jsonRepair.js');
    
    console.log('\n📄 Original broken JSON:');
    console.log('========================');
    console.log(brokenJSON.substring(0, 500) + '...');
    
    console.log('\n🔍 Validation of broken JSON:');
    console.log('=============================');
    const originalValidation = validateMenuJSON(brokenJSON);
    console.log(`Valid: ${originalValidation.valid ? '✅' : '❌'}`);
    if (!originalValidation.valid) {
      console.log('Errors:');
      originalValidation.errors.forEach(error => console.log(`  • ${error}`));
    }
    
    console.log('\n🔧 Repairing JSON...');
    console.log('====================');
    const repairResult = repairAndValidateMenuJSON(brokenJSON);
    
    if (repairResult.success) {
      console.log('✅ JSON repair successful!');
      console.log(`Items extracted: ${repairResult.items?.length || 0}`);
      
      console.log('\n📊 Repaired JSON:');
      console.log('=================');
      console.log(repairResult.json);
      
      console.log('\n📋 Extracted Items:');
      console.log('===================');
      repairResult.items?.forEach((item, index) => {
        console.log(`${index + 1}. ${item.title}`);
        console.log(`   Category: ${item.category}`);
        console.log(`   Price: £${item.price}`);
        console.log(`   Description: ${item.description}`);
        console.log('');
      });
      
      // Validate the repaired JSON
      console.log('\n🔍 Validation of repaired JSON:');
      console.log('===============================');
      const repairedValidation = validateMenuJSON(repairResult.json || '');
      console.log(`Valid: ${repairedValidation.valid ? '✅' : '❌'}`);
      if (!repairedValidation.valid) {
        console.log('Errors:');
        repairedValidation.errors.forEach(error => console.log(`  • ${error}`));
      }
      
      console.log(`\n📈 Summary:`);
      console.log(`Original items: ${originalValidation.items.length}`);
      console.log(`Repaired items: ${repairResult.items?.length || 0}`);
      console.log(`Success rate: ${((repairResult.items?.length || 0) / Math.max(originalValidation.items.length, 1) * 100).toFixed(1)}%`);
      
    } else {
      console.log('❌ JSON repair failed');
      console.log('Errors:');
      repairResult.errors?.forEach(error => console.log(`  • ${error}`));
    }
    
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testJSONRepair();
}

module.exports = { testJSONRepair };

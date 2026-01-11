import { errorToContext } from "@/lib/utils/error-to-context";

/**
 * Inventory Seed Data Script
 *
 * This script creates sample ingredients and recipes for testing the inventory system.
 *
 * Usage:
 * - Call seedInventoryData(venueId) from your seeding script or API route
 * - This will create:
 *   - 8 sample ingredients (bun, patty, cheese, lettuce, ketchup, coffee beans, milk, cups)
 *   - Stock levels for each ingredient
 *   - Recipe mappings for 3 menu items (if they exist)
 */

import { createAdminClient } from "@/lib/supabase";

interface SeedIngredient {

}

const SAMPLE_INGREDIENTS: SeedIngredient[] = [
  {

  },
  {

  },
  {

  },
  {

  },
  {

  },
  {

  },
  {

  },
  {

  },
];

interface RecipeMapping {

  }>;
}

const SAMPLE_RECIPES: RecipeMapping[] = [
  {

      { ingredientName: "Hamburger Bun", qty_per_item: 1, unit: "pcs" },
      { ingredientName: "Beef Patty", qty_per_item: 1, unit: "pcs" },
      { ingredientName: "Cheddar Cheese", qty_per_item: 30, unit: "g" },
      { ingredientName: "Lettuce", qty_per_item: 20, unit: "g" },
      { ingredientName: "Ketchup", qty_per_item: 15, unit: "ml" },
    ],
  },
  {

      { ingredientName: "Hamburger Bun", qty_per_item: 1, unit: "pcs" },
      { ingredientName: "Beef Patty", qty_per_item: 1, unit: "pcs" },
      { ingredientName: "Lettuce", qty_per_item: 20, unit: "g" },
      { ingredientName: "Ketchup", qty_per_item: 15, unit: "ml" },
    ],
  },
  {

      { ingredientName: "Coffee Beans", qty_per_item: 18, unit: "g" },
      { ingredientName: "Whole Milk", qty_per_item: 250, unit: "ml" },
      { ingredientName: "Paper Cups", qty_per_item: 1, unit: "pcs" },
    ],
  },
  {

      { ingredientName: "Coffee Beans", qty_per_item: 18, unit: "g" },
      { ingredientName: "Whole Milk", qty_per_item: 120, unit: "ml" },
      { ingredientName: "Paper Cups", qty_per_item: 1, unit: "pcs" },
    ],
  },
];

export async function seedInventoryData(venueId: string) {
  const supabase = createAdminClient();

  // Step 1: Create ingredients
  const createdIngredients: Record<string, string> = {
    /* Empty */
  }; // name -> id mapping

  for (const ingredient of SAMPLE_INGREDIENTS) {
    try {
      // Check if ingredient already exists
      const { data: existing } = await supabase
        .from("ingredients")
        .select("id")
        .eq("venue_id", venueId)
        .eq("name", ingredient.name)
        .single();

      if (existing) {
        createdIngredients[ingredient.name] = existing.id;
        continue;
      }

      // Create ingredient
      const { data, error } = await supabase
        .from("ingredients")
        .insert({

        .select()
        .single();

      if (error) {
        
        );
        continue;
      }

      createdIngredients[ingredient.name] = data.id;

      // Create initial stock ledger entry
      if (ingredient.initial_stock > 0) {
        await supabase.from("stock_ledgers").insert({

      }
    } catch (_error) {
      
      );
    }
  }

  // Step 2: Create recipe mappings
  for (const recipe of SAMPLE_RECIPES) {
    try {
      // Find menu item by name
      const { data: menuItem } = await supabase
        .from("menu_items")
        .select("id, name")
        .eq("venue_id", venueId)
        .ilike("name", `%${recipe.menuItemName}%`)
        .limit(1)
        .single();

      if (!menuItem) {
        
        continue;
      }

      // Delete existing recipe
      await supabase.from("menu_item_ingredients").delete().eq("menu_item_id", menuItem.id);

      // Create recipe mappings
      const recipeData = recipe.ingredients
        .map((ing) => {
          const ingredientId = createdIngredients[ing.ingredientName];
          if (!ingredientId) {
            
            return null;
          }

          return {

          };

        .filter(Boolean);

      if (recipeData.length > 0) {
        const { error } = await supabase.from("menu_item_ingredients").insert(recipeData);

        if (error) {
          
          );
        } else {
          // Block handled
        }
      }
    } catch (_error) {
      
      );
    }
  }

  return {

  };
}

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
import type { CreateIngredientRequest } from "@/types/inventory";
import { logger } from "@/lib/logger";

interface SeedIngredient {
  name: string;
  sku?: string;
  unit: string;
  cost_per_unit: number;
  initial_stock: number;
  par_level: number;
  reorder_level: number;
  supplier?: string;
}

const SAMPLE_INGREDIENTS: SeedIngredient[] = [
  {
    name: "Hamburger Bun",
    sku: "BUN-001",
    unit: "pcs",
    cost_per_unit: 0.5,
    initial_stock: 100,
    par_level: 150,
    reorder_level: 30,
    supplier: "Local Bakery",
  },
  {
    name: "Beef Patty",
    sku: "MEAT-001",
    unit: "pcs",
    cost_per_unit: 2.0,
    initial_stock: 80,
    par_level: 100,
    reorder_level: 20,
    supplier: "Prime Meats Co",
  },
  {
    name: "Cheddar Cheese",
    sku: "DAIRY-001",
    unit: "g",
    cost_per_unit: 0.015,
    initial_stock: 2000,
    par_level: 3000,
    reorder_level: 500,
    supplier: "Dairy Fresh",
  },
  {
    name: "Lettuce",
    sku: "VEG-001",
    unit: "g",
    cost_per_unit: 0.005,
    initial_stock: 1500,
    par_level: 2000,
    reorder_level: 400,
    supplier: "Farm Fresh Produce",
  },
  {
    name: "Ketchup",
    sku: "COND-001",
    unit: "ml",
    cost_per_unit: 0.008,
    initial_stock: 5000,
    par_level: 6000,
    reorder_level: 1000,
    supplier: "Condiment Suppliers Inc",
  },
  {
    name: "Coffee Beans",
    sku: "BEV-001",
    unit: "g",
    cost_per_unit: 0.02,
    initial_stock: 3000,
    par_level: 5000,
    reorder_level: 1000,
    supplier: "Premium Coffee Roasters",
  },
  {
    name: "Whole Milk",
    sku: "DAIRY-002",
    unit: "ml",
    cost_per_unit: 0.003,
    initial_stock: 10000,
    par_level: 15000,
    reorder_level: 3000,
    supplier: "Dairy Fresh",
  },
  {
    name: "Paper Cups",
    sku: "SUPPLY-001",
    unit: "pcs",
    cost_per_unit: 0.15,
    initial_stock: 200,
    par_level: 300,
    reorder_level: 50,
    supplier: "Restaurant Supplies Co",
  },
];

interface RecipeMapping {
  menuItemName: string; // We'll search by name since we don't have IDs yet
  ingredients: Array<{
    ingredientName: string;
    qty_per_item: number;
    unit: string;
  }>;
}

const SAMPLE_RECIPES: RecipeMapping[] = [
  {
    menuItemName: "Cheeseburger",
    ingredients: [
      { ingredientName: "Hamburger Bun", qty_per_item: 1, unit: "pcs" },
      { ingredientName: "Beef Patty", qty_per_item: 1, unit: "pcs" },
      { ingredientName: "Cheddar Cheese", qty_per_item: 30, unit: "g" },
      { ingredientName: "Lettuce", qty_per_item: 20, unit: "g" },
      { ingredientName: "Ketchup", qty_per_item: 15, unit: "ml" },
    ],
  },
  {
    menuItemName: "Burger",
    ingredients: [
      { ingredientName: "Hamburger Bun", qty_per_item: 1, unit: "pcs" },
      { ingredientName: "Beef Patty", qty_per_item: 1, unit: "pcs" },
      { ingredientName: "Lettuce", qty_per_item: 20, unit: "g" },
      { ingredientName: "Ketchup", qty_per_item: 15, unit: "ml" },
    ],
  },
  {
    menuItemName: "Latte",
    ingredients: [
      { ingredientName: "Coffee Beans", qty_per_item: 18, unit: "g" },
      { ingredientName: "Whole Milk", qty_per_item: 250, unit: "ml" },
      { ingredientName: "Paper Cups", qty_per_item: 1, unit: "pcs" },
    ],
  },
  {
    menuItemName: "Cappuccino",
    ingredients: [
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
          venue_id: venueId,
          name: ingredient.name,
          sku: ingredient.sku,
          unit: ingredient.unit,
          cost_per_unit: ingredient.cost_per_unit,
          par_level: ingredient.par_level,
          reorder_level: ingredient.reorder_level,
          supplier: ingredient.supplier,
        })
        .select()
        .single();

      if (error) {
        logger.error(
          `[INVENTORY SEED] Error creating ingredient "${ingredient.name}":`,
          errorToContext(error)
        );
        continue;
      }

      createdIngredients[ingredient.name] = data.id;

      // Create initial stock ledger entry
      if (ingredient.initial_stock > 0) {
        await supabase.from("stock_ledgers").insert({
          ingredient_id: data.id,
          venue_id: venueId,
          delta: ingredient.initial_stock,
          reason: "receive",
          ref_type: "manual",
          note: "Initial seed stock",
        });
      }

    } catch (_error) {
      logger.error(
        `[INVENTORY SEED] Unexpected _error for ingredient "${ingredient.name}":`,
        errorToContext(_error)
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
        logger.debug(
          `[INVENTORY SEED] Menu item "${recipe.menuItemName}" not found, skipping recipe`
        );
        continue;
      }

      // Delete existing recipe
      await supabase.from("menu_item_ingredients").delete().eq("menu_item_id", menuItem.id);

      // Create recipe mappings
      const recipeData = recipe.ingredients
        .map((ing) => {
          const ingredientId = createdIngredients[ing.ingredientName];
          if (!ingredientId) {
            logger.debug(
              `[INVENTORY SEED] Ingredient "${ing.ingredientName}" not found for recipe`
            );
            return null;
          }

          return {
            menu_item_id: menuItem.id,
            ingredient_id: ingredientId,
            qty_per_item: ing.qty_per_item,
            unit: ing.unit,
          };
        })
        .filter(Boolean);

      if (recipeData.length > 0) {
        const { error } = await supabase.from("menu_item_ingredients").insert(recipeData);

        if (error) {
          logger.error(
            `[INVENTORY SEED] Error creating recipe for "${recipe.menuItemName}":`,
            errorToContext(error)
          );
        } else {
        }
      }
    } catch (_error) {
      logger.error(
        `[INVENTORY SEED] Unexpected _error for recipe "${recipe.menuItemName}":`,
        errorToContext(_error)
      );
    }
  }


  return {
    success: true,
    ingredientsCreated: Object.keys(createdIngredients).length,
    message: "Inventory seed data created successfully",
  };
}

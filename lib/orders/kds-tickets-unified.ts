/**
 * Unified KDS Ticket Creation with Category/Keyword-Based Station Assignment
 *
 * Station assignment priority:
 * 1. Category-based assignment (if menu item category is mapped to a station in kds_station_categories)
 * 2. Keyword-based assignment (smart keyword matching with priority tiers)
 * 3. Default to Expo station
 *
 * This is the single source of truth for creating KDS tickets.
 * All order creation and backfill operations should use this function.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAI } from "@/lib/openai";
import { AICache } from "@/lib/cache";
import { env } from "@/lib/env";

export interface OrderForKDSTickets {

  }>;
  customer_name?: string;
  table_number?: number | null;
  table_id?: string;
}

interface KDSStation {

}

/**
 * Creates KDS tickets for an order with category/keyword-based station assignment
 *
 * Assignment logic:
 * 1. First tries category-based assignment (menu item category → station mapping)
 * 2. Falls back to keyword-based assignment (item name keywords → station type)
 * 3. Defaults to Expo station if no match found
 */
export async function createKDSTicketsWithAI(

  };

  try {
     ? order.items.length : 0,

    // Step 1: Ensure KDS stations exist for this venue
    
    let existingStations = await ensureKDSStations(supabase, order.venue_id);

    if (!existingStations || existingStations.length === 0) {
      
      throw new Error("No KDS stations available");
    }

    

    // Step 2: Get expo station as default
    const expoStation =
      existingStations.find((s) => s.station_type === "expo") || existingStations[0];

    if (!expoStation) {
      
      throw new Error("No KDS station available");
    }

    // Step 3: Get table label
    
    const tableLabel = await getTableLabel(supabase, order);
    

    // Step 4: Create tickets for each order item with AI assignment
    const items = Array.isArray(order.items) ? order.items : [];
    

    if (items.length === 0) {
      
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemName = item.item_name || "Unknown Item";
      const menuItemId = item.menu_item_id;

      

      // Step 1: Try category-based assignment (menu item category → station mapping)
      let assignedStation: KDSStation | null = null;
      let assignment: StationAssignment | null = null;
      
      if (menuItemId) {
        try {
          // First, get the menu item to find its category
          const { data: menuItem } = await supabase
            .from("menu_items")
            .select("category, name")
            .eq("id", menuItemId)
            .eq("venue_id", order.venue_id)
            .single();

          if (menuItem && menuItem.category) {
            // Category-based assignment: check if this menu category is mapped to a station
            const { data: categoryStation } = await supabase
              .from("kds_station_categories")
              .select("station_id")
              .eq("venue_id", order.venue_id)
              .eq("menu_category", menuItem.category)
              .eq("is_active", true)
              .maybeSingle();

            if (categoryStation?.station_id) {
              const stationFromCategory = existingStations.find(
                (s) => s.id === categoryStation.station_id
              );
              if (stationFromCategory) {
                assignedStation = stationFromCategory;
                // Category-based assignment has high confidence
                assignment = { station: stationFromCategory, confidence: 0.95 };
                
              }
            }
          }
        } catch (error) {

            }
          );
        }
      }

      // Step 2: Keyword-based assignment (if category mapping not found)
      // Uses hardcoded keyword lists to match item names to station types
      if (!assignment) {
        assignment = assignStationByKeywords(itemName, existingStations, expoStation);
        assignedStation = assignment.station;
      }

      // Step 3: Hybrid approach - Use AI fallback for low confidence assignments
      // Only call AI if confidence is below threshold (0.7) to avoid unnecessary API calls
      const CONFIDENCE_THRESHOLD = 0.7;
      if (assignment.confidence < CONFIDENCE_THRESHOLD) {
        

        try {
          // Get menu item description if available for better AI context
          let itemDescription: string | undefined;
          if (menuItemId) {
            try {
              const { data: menuItem } = await supabase
                .from("menu_items")
                .select("description_en, description_ar, name")
                .eq("id", menuItemId)
                .eq("venue_id", order.venue_id)
                .single();
              itemDescription = menuItem?.description_en || menuItem?.description_ar;
            } catch {
              // Description not critical, continue without it
            }
          }

          const aiAssignment = await assignStationWithAI(
            itemName,
            itemDescription,
            existingStations,
            order.venue_id,
            expoStation
          );

          // Use AI assignment if it has higher confidence
          if (aiAssignment.confidence > assignment.confidence) {
            assignment = aiAssignment;
            assignedStation = assignment.station;
            ", {
              ...baseContext,
              itemName,

          } else {
            ", {
              ...baseContext,
              itemName,

          }
        } catch (aiError) {
          // AI failed, continue with keyword assignment

        }
      }

      // Ensure assignedStation is never null (should be set by assignment at this point)
      if (!assignedStation) {
        
        assignedStation = expoStation;
        assignment = { station: expoStation, confidence: 0.5 };
      }

      

      // Combine special instructions and modifiers for kitchen display
      let combinedInstructions = item.specialInstructions || "";

      // If modifiers exist, format them and add to instructions
      if (item.modifiers) {
        let modifiersText = "";
        try {
          // Handle modifiers as object or array
          if (typeof item.modifiers === "object" && item.modifiers !== null) {
            if (Array.isArray(item.modifiers)) {
              // Array of modifiers: ["Extra Cheese", "No Onions"]
              modifiersText = item.modifiers.join(", ");
            } else {
              // Object modifiers: { size: "Large", toppings: ["Pepperoni"] }
              const modParts: string[] = [];
              for (const [key, value] of Object.entries(item.modifiers)) {
                if (Array.isArray(value)) {
                  modParts.push(`${key}: ${value.join(", ")}`);
                } else if (value) {
                  modParts.push(`${key}: ${value}`);
                }
              }
              modifiersText = modParts.join(" | ");
            }
          } else if (typeof item.modifiers === "string") {
            modifiersText = item.modifiers;
          }
        } catch (error) {
          
        }

        // Combine instructions and modifiers
        if (modifiersText) {
          combinedInstructions = combinedInstructions
            ? `${combinedInstructions} | ${modifiersText}`

        }
      }

      const ticketData = {

      };

      

      const { error: ticketError } = await supabase.from("kds_tickets").insert(ticketData);

      if (ticketError) {
        
        // Convert to proper Error with details
        const errorMsg = `KDS ticket insert failed: ${ticketError.message || ticketError.code || "Unknown error"}`;
        const error = new Error(errorMsg);
        (error as unknown as { details: unknown }).details = ticketError;
        throw error;
      }

      
    }

    
  } catch (error) {

    throw error;
  }
}

/**
 * Ensures KDS stations exist for a venue, creates defaults if needed
 */
async function ensureKDSStations(supabase: SupabaseClient, venueId: string): Promise<KDSStation[]> {
  let { data: existingStations } = await supabase
    .from("kds_stations")
    .select("id, station_type, station_name")
    .eq("venue_id", venueId)
    .eq("is_active", true);

  if (!existingStations || existingStations.length === 0) {
    

    // Create default stations
    const defaultStations = [
      { name: "Expo", type: "expo", order: 0, color: "#3b82f6" },
      { name: "Grill", type: "grill", order: 1, color: "#ef4444" },
      { name: "Fryer", type: "fryer", order: 2, color: "#f59e0b" },
      { name: "Barista", type: "barista", order: 3, color: "#8b5cf6" },
      { name: "Cold Prep", type: "cold", order: 4, color: "#06b6d4" },
    ];

    for (const station of defaultStations) {
      await supabase.from("kds_stations").upsert(
        {

        },
        {
          onConflict: "venue_id,station_name",
        }
      );
    }

    // Fetch stations again
    const { data: stations } = await supabase
      .from("kds_stations")
      .select("id, station_type, station_name")
      .eq("venue_id", venueId)
      .eq("is_active", true);

    if (!stations || stations.length === 0) {
      throw new Error("Failed to create KDS stations");
    }

    existingStations = stations;
  }

  return existingStations as KDSStation[];
}

/**
 * Gets table label from table_id or table_number
 */
async function getTableLabel(supabase: SupabaseClient, order: OrderForKDSTickets): Promise<string> {
  const customerName = order.customer_name;
  let tableLabel = customerName || "Guest";

  if (order.table_id) {
    const { data: tableData } = await supabase
      .from("tables")
      .select("label")
      .eq("id", order.table_id)
      .single();

    if (tableData?.label) {
      tableLabel = tableData.label;
    }
  } else if (order.table_number) {
    tableLabel = `Table ${order.table_number}`;
  }

  return tableLabel;
}

interface StationAssignment {

}

/**
 * Assigns a station to an item using smart keyword categorization with conflict resolution
 * Priority order: Barista → Fryer → Pizza/Pasta → Grill → Cold Prep → Expo
 * Returns station assignment with confidence score (0.0 to 1.0)
 */
function assignStationByKeywords(

    "latte",
    "cappuccino",
    "espresso",
    "mocha",
    "americano",
    "macchiato",
    "flat white",
    "cortado",
    "doppio",
    "lungo",
    "ristretto",
    "tea",
    "matcha",
    "chai",
    "hot chocolate",
    "cocoa",
    "hot cocoa",
    "smoothie",
    "juice",
    "shake",
    "milkshake",
    "frappe",
    "frappuccino",
    "drink",
    "beverage",
    "yogurt",
    "acai",
    "parfait",
    "bubble tea",
    "boba",
    "iced tea",
    "iced coffee",
    "cold brew",
    "refresher",
    "lemonade",
    "iced",
    "soda",
    "soft drink",
    "energy drink",
  ];

  if (baristaKeywords.some((keyword) => itemNameLower.includes(keyword))) {
    const baristaStation = stations.find((s) => s.station_type === "barista");
    if (baristaStation) {
      
      return { station: baristaStation, confidence: 0.9 }; // High confidence for exact keyword matches
    }
  }

  // ============================================
  // TIER 2: Fryer Station - Fried items (Before Grill to catch "fried chicken", "wings")
  // ============================================
  const fryerKeywords = [
    "fries",
    "chips",
    "fried",
    "fryer",
    "wings",
    "nuggets",
    "crispy",
    "tempura",
    "calamari",
    "onion rings",
    "mozzarella sticks",
    "spring rolls",
    "samosa",
    "pakora",
    "fritter",
    "doughnut",
    "donut",
    "beignet",
    "churro",
    "funnel cake",
    "corn dog",
    "fish and chips",
  ];

  // Special handling: "fried chicken" should go to Fryer, not Grill
  if (fryerKeywords.some((keyword) => itemNameLower.includes(keyword))) {
    const fryerStation = stations.find((s) => s.station_type === "fryer");
    if (fryerStation) {
      
      return { station: fryerStation, confidence: 0.9 };
    }
  }

  // ============================================
  // TIER 3: Pizza/Pasta Station (if exists) - Check before Grill
  // ============================================
  const pizzaPastaKeywords = [
    "pizza",
    "pasta",
    "spaghetti",
    "penne",
    "fettuccine",
    "linguine",
    "ravioli",
    "lasagna",
    "gnocchi",
    "risotto",
    "carbonara",
    "alfredo",
    "marinara",
    "bolognese",
    "pesto",
    "calzone",
    "stromboli",
    "flatbread",
  ];

  if (pizzaPastaKeywords.some((keyword) => itemNameLower.includes(keyword))) {
    // Try pizza/pasta station first
    const pizzaStation = stations.find(
      (s) => s.station_type === "pizza" || s.station_type === "pasta"
    );
    if (pizzaStation) {
      
      return { station: pizzaStation, confidence: 0.9 };
    }
    // If no dedicated pizza/pasta station, fall through to Grill (many venues handle pizza at grill)
  }

  // ============================================
  // TIER 4: Grill Station - Hot grilled/cooked items
  // ============================================
  // Exclude items that should go to other stations
  const isColdPrepItem =
    itemNameLower.includes("salad") ||
    itemNameLower.includes("sandwich") ||
    itemNameLower.includes("wrap") ||
    itemNameLower.includes("sushi") ||
    itemNameLower.includes("poke") ||
    itemNameLower.includes("cold");

  const isSoupItem =
    itemNameLower.includes("soup") ||
    itemNameLower.includes("stew") ||
    itemNameLower.includes("chowder") ||
    itemNameLower.includes("bisque") ||
    itemNameLower.includes("broth");

  const grillKeywords = [
    "burger",
    "steak",
    "chicken",
    "beef",
    "lamb",
    "pork",
    "sausage",
    "kebab",
    "grill",
    "bbq",
    "barbecue",
    "ribs",
    "halloumi",
    "patty",
    "meat",
    "bacon",
    "pancake",
    "waffle",
    "toast",
    "croissant",
    "bagel",
    "omelet",
    "omelette",
    "eggs",
    "breakfast",
    "brunch",
    "hash",
    "skewer",
    "kabob",
    "shish",
    "tandoori",
    "tikka",
    "curry",
    "masala",
    "teriyaki",
    "stir fry",
    "stir-fry",
    "wok",
    "fajita",
    "quesadilla",
    "taco",
    "burrito",
    "enchilada",
    "queso",
    "nachos",
    "loaded",
  ];

  if (
    grillKeywords.some((keyword) => itemNameLower.includes(keyword)) &&
    !isColdPrepItem &&
    !isSoupItem
  ) {
    const grillStation = stations.find((s) => s.station_type === "grill");
    if (grillStation) {

      return { station: grillStation, confidence: 0.85 };
    }
  }

  // ============================================
  // TIER 5: Soup Station (if exists) or Grill fallback
  // ============================================
  if (isSoupItem) {
    const soupStation = stations.find((s) => s.station_type === "soup");
    if (soupStation) {
      
      return { station: soupStation, confidence: 0.9 };
    }
    // If no soup station, soups often prepared at Grill
    const grillStation = stations.find((s) => s.station_type === "grill");
    if (grillStation) {
      ", {
        itemName,

        confidence: 0.7, // Lower confidence for fallback

      return { station: grillStation, confidence: 0.7 };
    }
  }

  // ============================================
  // TIER 6: Cold Prep Station - Salads, sandwiches, cold items
  // ============================================
  const coldPrepKeywords = [
    "salad",
    "sandwich",
    "wrap",
    "cold",
    "sushi",
    "poke",
    "hummus",
    "mezze",
    "dip",
    "labneh",
    "tzatziki",
    "avo",
    "avocado",
    "ceviche",
    "tartare",
    "carpaccio",
    "bruschetta",
    "antipasto",
    "charcuterie",
    "cheese board",
    "platter",
    "gazpacho",
  ];

  // Only match "bowl" if it's NOT a drink bowl (already caught by Barista)
  const isDrinkBowl =
    itemNameLower.includes("matcha") ||
    itemNameLower.includes("yogurt") ||
    itemNameLower.includes("acai") ||
    itemNameLower.includes("parfait");

  if (
    coldPrepKeywords.some((keyword) => itemNameLower.includes(keyword)) ||
    (itemNameLower.includes("bowl") && !isDrinkBowl)
  ) {
    const coldStation = stations.find((s) => s.station_type === "cold");
    if (coldStation) {
      
      return { station: coldStation, confidence: 0.9 };
    }
  }

  // ============================================
  // TIER 7: Dessert Station (if exists)
  // ============================================
  const dessertKeywords = [
    "dessert",
    "cake",
    "pie",
    "tart",
    "mousse",
    "pudding",
    "custard",
    "ice cream",
    "gelato",
    "sorbet",
    "cheesecake",
    "brownie",
    "cookie",
    "biscuit",
    "muffin",
    "scone",
    "pastry",
    "eclair",
    "tiramisu",
    "creme brulee",
    "flan",
    "panna cotta",
  ];

  if (dessertKeywords.some((keyword) => itemNameLower.includes(keyword))) {
    const dessertStation = stations.find((s) => s.station_type === "dessert");
    if (dessertStation) {
      
      return { station: dessertStation, confidence: 0.9 };
    }
    // If no dessert station, desserts often prepared at Cold Prep or Barista
    const coldStation = stations.find((s) => s.station_type === "cold");
    if (coldStation) {
      ", {
        itemName,

        confidence: 0.7, // Lower confidence for fallback

      return { station: coldStation, confidence: 0.7 };
    }
  }

  // ============================================
  // FALLBACK: Default to Expo if no match
  // ============================================
  
  return { station: defaultStation, confidence: 0.5 };
}

/**
 * Assigns a station to an item using AI (OpenAI GPT-4o-mini)
 * Only used as fallback when keyword-based assignment has low confidence
 */
async function assignStationWithAI(

  const cached = await AICache.kdsStation.get(itemName, venueId, stationTypes);
  if (cached) {
    const cachedResult = cached as { stationId: string; confidence: number };
    const cachedStation = stations.find((s) => s.id === cachedResult.stationId) || defaultStation;
    
    return { station: cachedStation, confidence: cachedResult.confidence };
  }

  // Check if OpenAI is available
  let openaiApiKey: string | undefined;
  try {
    openaiApiKey = env("OPENAI_API_KEY");
  } catch {
    // OpenAI not configured, fallback to default
    
    return { station: defaultStation, confidence: 0.5 };
  }

  if (!openaiApiKey) {
    
    return { station: defaultStation, confidence: 0.5 };
  }

  try {
    const openai = getOpenAI();

    // Build station list for prompt
    const stationList = stations
      .map((s) => `- ${s.station_name || s.station_type} (${s.station_type})`)
      .join("\n");

    const prompt = `You are a restaurant kitchen display system assistant. Assign a kitchen station to this menu item.

Menu Item: "${itemName}"
${itemDescription ? `Description: "${itemDescription}"` : ""}

Available Stations:
${stationList}

Station Types Guide:
- barista: Coffee, tea, hot drinks, smoothies, juices, cold beverages
- fryer: Fried foods, fries, wings, tempura, crispy items
- grill: Grilled meats, burgers, steaks, hot cooked items, BBQ
- pizza/pasta: Pizza, pasta, Italian dishes
- cold: Salads, sandwiches, wraps, cold prep, sushi, poke
- soup: Soups, stews, chowders
- dessert: Desserts, cakes, pastries, ice cream
- expo: General/unspecified items, final quality check

Respond with ONLY the station type (e.g., "grill", "barista", "expo") that best matches this item.
Do not include any explanation or additional text.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and cheap
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // Low temperature for consistency

    const aiStationType = response.choices[0]?.message?.content?.trim().toLowerCase();

    if (!aiStationType) {
      
      return { station: defaultStation, confidence: 0.5 };
    }

    // Find matching station
    const matchedStation =
      stations.find((s) => s.station_type.toLowerCase() === aiStationType) ||
      stations.find((s) => s.station_name?.toLowerCase().includes(aiStationType)) ||
      defaultStation;

    const confidence = matchedStation !== defaultStation ? 0.85 : 0.5;

    

    // Cache the result
    await AICache.kdsStation.set(itemName, venueId, stationTypes, {

      confidence,

    return { station: matchedStation, confidence };
  } catch (error) {

    // Gracefully degrade to default station
    return { station: defaultStation, confidence: 0.5 };
  }
}

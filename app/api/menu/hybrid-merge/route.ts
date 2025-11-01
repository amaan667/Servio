import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import OpenAI from "openai";
import { extractMenuFromWebsite } from "@/lib/webMenuExtractor";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Hybrid Menu Merge API
 * Intelligently compares PDF-extracted menu with URL-scraped menu
 * Uses AI to match items and merge data (prices, descriptions, images)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { venueId, menuUrl } = body;

    if (!venueId || !menuUrl) {
      return NextResponse.json(
        { ok: false, error: "venueId and menuUrl required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Step 1: Get existing PDF-extracted menu items
    const { data: existingItems, error: fetchError } = await supabase
      .from("menu_items")
      .select("*")
      .eq("venue_id", venueId)
      .order("position", { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch existing menu: ${fetchError.message}`);
    }

    if (!existingItems || existingItems.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No existing PDF menu found. Please upload a PDF first.",
        },
        { status: 400 }
      );
    }

    // Step 2: Scrape menu from URL using new Puppeteer + Vision AI
    logger.info("[HYBRID MERGE] Starting web extraction with Puppeteer + Vision AI", {
      url: menuUrl,
      venueId,
    });

    let urlMenuData;
    try {
      // Use new Puppeteer + Vision AI extraction directly
      const extractedItems = await extractMenuFromWebsite(menuUrl);

      logger.info("[HYBRID MERGE] Web extraction complete", {
        itemCount: extractedItems.length,
        withImages: extractedItems.filter((i) => i.image_url).length,
      });

      // Convert to expected format
      urlMenuData = {
        ok: true,
        items: extractedItems.map((item) => ({
          name: item.name,
          description: item.description || "",
          price: item.price || 0,
          category: item.category || "Menu Items",
          image_url: item.image_url || null,
        })),
      };
    } catch (scrapeError) {
      logger.error("[HYBRID MERGE] Web extraction failed", {
        error: scrapeError,
        errorMessage: scrapeError instanceof Error ? scrapeError.message : String(scrapeError),
      });

      return NextResponse.json(
        {
          ok: false,
          error: `Failed to scrape menu from URL: ${scrapeError instanceof Error ? scrapeError.message : "Unknown error"}. Check Railway logs for details.`,
        },
        { status: 500 }
      );
    }

    const urlItems = urlMenuData.items || [];

    logger.info("[HYBRID MERGE] URL items processed", {
      count: urlItems.length,
      existingPdfItems: existingItems.length,
    });

    if (urlItems.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `No items found at URL. The website might require JavaScript or have an unusual structure. Try a direct menu page URL.`,
          debug: {
            urlChecked: menuUrl,
            suggestion: "Try the direct menu page URL (e.g., /menu or /food)",
          },
        },
        { status: 400 }
      );
    }

    // Step 3: Use AI to intelligently match and merge items
    logger.info("[HYBRID MERGE] Starting AI merge", {
      pdfItems: existingItems.length,
      urlItems: urlItems.length,
    });

    const aiPrompt = `You are a menu data expert. Compare these two menus and intelligently merge them.

PDF Menu Items (${existingItems.length} items):
${JSON.stringify(
  existingItems.map((item) => ({
    name: item.name,
    description: item.description,
    price: item.price,
    category: item.category,
  })),
  null,
  2
)}

URL Menu Items (${urlItems.length} items):
${JSON.stringify(
  urlItems.map(
    (item: {
      name: string;
      description?: string;
      price: number;
      category: string;
      image?: string;
    }) => ({
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      image: item.image,
    })
  ),
  null,
  2
)}

Instructions:
1. Match items from URL to PDF items by name similarity (fuzzy matching)
2. For matched items:
   - Keep PDF item structure (id, position, etc.)
   - UPDATE price if URL has different price (URL is more current)
   - UPDATE description if URL has better/longer description
   - ADD image from URL if PDF doesn't have one
   - MERGE categories intelligently
3. For unmatched URL items:
   - Mark as "new_from_url": true
4. For unmatched PDF items:
   - Keep as-is (they exist in PDF but not online)

Return a JSON array of merged items with this structure:
[{
  "pdf_item_id": "uuid or null if new",
  "name": "Item Name",
  "description": "Description (from URL if better, else PDF)",
  "price": number (from URL if different, else PDF),
  "category": "Category",
  "image": "URL or null",
  "action": "update" | "keep" | "new",
  "changes": ["price_updated", "description_added", "image_added"] or []
}]

Be smart about matching:
- "Eggs Benedict" matches "Eggs Benedict Add-on"
- "Chicken Waffles" matches "Chicken & Waffles"
- Use fuzzy string matching
- Consider price similarity as secondary indicator`;

    logger.info("[HYBRID MERGE] Calling OpenAI for merge analysis...");
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a menu data expert. Return ONLY valid JSON, no markdown, no explanation.",
        },
        {
          role: "user",
          content: aiPrompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    logger.info("[HYBRID MERGE] OpenAI response received");

    const aiContent = aiResponse.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error("AI response was empty");
    }

    let mergedItems;
    try {
      const parsed = JSON.parse(aiContent);
      mergedItems = parsed.items || parsed.mergedItems || parsed;
      if (!Array.isArray(mergedItems)) {
        mergedItems = [mergedItems];
      }
      logger.info("[HYBRID MERGE] AI merge parsed successfully", {
        mergedCount: mergedItems.length,
      });
    } catch (_parseError) {
      logger.error("[HYBRID MERGE] Failed to parse AI response", { error: _parseError });
      throw new Error("AI returned invalid JSON");
    }

    // Step 4: Apply updates to database
    logger.info("[HYBRID MERGE] Processing merge results for database updates...");

    const updates = [];
    const inserts = [];
    const stats = {
      updated: 0,
      new: 0,
      unchanged: 0,
      prices_updated: 0,
      descriptions_added: 0,
      images_added: 0,
    };

    for (const mergedItem of mergedItems) {
      if (mergedItem.action === "update" && mergedItem.pdf_item_id) {
        // Update existing item
        const updateData: Record<string, string | number> = {
          /* Empty */
        };

        if (mergedItem.changes.includes("price_updated")) {
          updateData.price = mergedItem.price;
          stats.prices_updated++;
        }

        if (
          mergedItem.changes.includes("description_added") ||
          mergedItem.changes.includes("description_updated")
        ) {
          updateData.description = mergedItem.description;
          stats.descriptions_added++;
        }

        if (mergedItem.changes.includes("image_added") && mergedItem.image) {
          updateData.image_url = mergedItem.image;
          stats.images_added++;
        }

        if (Object.keys(updateData).length > 0) {
          updateData.updated_at = new Date().toISOString();
          updates.push({
            id: mergedItem.pdf_item_id,
            ...updateData,
          });
          stats.updated++;
        } else {
          stats.unchanged++;
        }
      } else if (mergedItem.action === "new") {
        // New item from URL
        inserts.push({
          venue_id: venueId,
          name: mergedItem.name,
          description: mergedItem.description || null,
          price: mergedItem.price,
          category: mergedItem.category || "Other",
          image_url: mergedItem.image || null,
          is_available: true,
          position: existingItems.length + inserts.length,
          created_at: new Date().toISOString(),
        });
        stats.new++;
      } else {
        stats.unchanged++;
      }
    }

    // Execute database updates
    logger.info("[HYBRID MERGE] Applying database changes", {
      updates: updates.length,
      inserts: inserts.length,
    });

    if (updates.length > 0) {
      for (const update of updates) {
        const { id, ...updateData } = update;
        const { error } = await supabase
          .from("menu_items")
          .update(updateData)
          .eq("id", id)
          .eq("venue_id", venueId);

        if (error) {
          logger.error("[HYBRID MERGE] Update failed for item", { id, error: error.message });
        }
      }
      logger.info("[HYBRID MERGE] Database updates completed", { count: updates.length });
    }

    // Execute database inserts
    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("menu_items").insert(inserts);

      if (insertError) {
        logger.error("[HYBRID MERGE] Insert failed", { error: insertError.message });
        throw new Error(`Failed to insert new items: ${insertError.message}`);
      }
      logger.info("[HYBRID MERGE] Database inserts completed", { count: inserts.length });
    }

    logger.info("[HYBRID MERGE] ===== MERGE COMPLETED SUCCESSFULLY =====", {
      stats,
    });

    return NextResponse.json({
      ok: true,
      stats,
      message: `Merged successfully: ${stats.updated} updated, ${stats.new} new items added`,
      details: {
        pricesUpdated: stats.prices_updated,
        descriptionsAdded: stats.descriptions_added,
        imagesAdded: stats.images_added,
      },
    });
  } catch (_error) {
    logger.error(
      "[HYBRID MERGE] Unexpected error:",
      _error instanceof Error ? _error : { error: String(_error) }
    );

    return NextResponse.json(
      {
        ok: false,
        error: _error instanceof Error ? _error.message : "Failed to merge menus",
      },
      { status: 500 }
    );
  }
}

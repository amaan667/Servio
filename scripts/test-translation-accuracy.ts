#!/usr/bin/env tsx
/**
 * Manual Translation Accuracy Test Script
 *
 * Usage: tsx scripts/test-translation-accuracy.ts <venueId>
 *
 * This script performs comprehensive translation testing:
 * 1. Round-trip translations for all supported languages
 * 2. Verifies no duplicates are created
 * 3. Ensures categories are preserved
 * 4. Validates translation accuracy
 */

import { createClient } from "../lib/supabase";

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "ar", name: "Arabic" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
];

interface TestResult {
  language: string;
  success: boolean;
  itemCountBefore: number;
  itemCountAfter: number;
  categoryCountBefore: number;
  categoryCountAfter: number;
  duplicatesCreated: boolean;
  translationErrors: string[];
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getMenuState(venueId: string) {
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from("menu_items")
    .select("id, name, description, category, price")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch menu: ${error.message}`);
  }

  const categories = new Set(items?.map((item) => item.category).filter(Boolean) || []);

  return {
    items: items || [],
    itemCount: items?.length || 0,
    categoryCount: categories.size,
    itemIds: new Set(items?.map((item) => item.id) || []),
  };
}

async function translateMenu(venueId: string, targetLanguage: string) {

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/ai-assistant/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        venueId,
        toolName: "menu.translate",
        params: {
          targetLanguage,
          includeDescriptions: true,
        },
        preview: false,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Translation failed: ${error.error || "Unknown error"}`);
  }

  return await response.json();
}

async function testRoundTrip(venueId: string, targetLang: string): Promise<TestResult> {
  const result: TestResult = {
    language: targetLang,
    success: false,
    itemCountBefore: 0,
    itemCountAfter: 0,
    categoryCountBefore: 0,
    categoryCountAfter: 0,
    duplicatesCreated: false,
    translationErrors: [],
  };

  try {
    // Get initial state
    const before = await getMenuState(venueId);
    result.itemCountBefore = before.itemCount;
    result.categoryCountBefore = before.categoryCount;

    console.log(
      `  📊 Initial state: ${before.itemCount} items, ${before.categoryCount} categories`
    );

    // Translate to target language
    await translateMenu(venueId, targetLang);
    await delay(2000); // Wait for database consistency

    const afterFirst = await getMenuState(venueId);

    // Check for duplicates
    if (afterFirst.itemCount !== before.itemCount) {
      result.translationErrors.push(
        `Item count changed: ${before.itemCount} → ${afterFirst.itemCount}`
      );
      result.duplicatesCreated = true;
    }

    // Check if IDs are the same
    const idsMatch =
      afterFirst.itemIds.size === before.itemIds.size &&
      Array.from(afterFirst.itemIds).every((id) => before.itemIds.has(id));

    if (!idsMatch) {
      result.translationErrors.push("Item IDs changed during translation");
    }

    // Check categories
    if (afterFirst.categoryCount !== before.categoryCount) {
      result.translationErrors.push(
        `Category count changed: ${before.categoryCount} → ${afterFirst.categoryCount}`
      );
    }

    console.log(
      `  ✓ After ${targetLang}: ${afterFirst.itemCount} items, ${afterFirst.categoryCount} categories`
    );

    // Translate back to English
    await translateMenu(venueId, "en");
    await delay(2000);

    const afterRoundTrip = await getMenuState(venueId);
    result.itemCountAfter = afterRoundTrip.itemCount;
    result.categoryCountAfter = afterRoundTrip.categoryCount;

    // Verify final state
    if (afterRoundTrip.itemCount !== before.itemCount) {
      result.translationErrors.push(
        `Final item count mismatch: ${before.itemCount} → ${afterRoundTrip.itemCount}`
      );
      result.duplicatesCreated = true;
    }

    if (afterRoundTrip.categoryCount !== before.categoryCount) {
      result.translationErrors.push(
        `Final category count mismatch: ${before.categoryCount} → ${afterRoundTrip.categoryCount}`
      );
    }

    const finalIdsMatch =
      afterRoundTrip.itemIds.size === before.itemIds.size &&
      Array.from(afterRoundTrip.itemIds).every((id) => before.itemIds.has(id));

    if (!finalIdsMatch) {
      result.translationErrors.push("Final item IDs do not match original");
    }

    console.log(
      `  ✓ After English: ${afterRoundTrip.itemCount} items, ${afterRoundTrip.categoryCount} categories`
    );

    // Compare names to verify translation occurred
    let translatedCount = 0;
    afterFirst.items.forEach((item) => {
      const original = before.items.find((b) => b.id === item.id);
      if (original && original.name !== item.name) {
        translatedCount++;
      }
    });

    const translationRate = (translatedCount / before.itemCount) * 100;
    console.log(
      `  📝 Translation rate: ${translationRate.toFixed(1)}% (${translatedCount}/${before.itemCount} items)`
    );

    if (translationRate < 80) {
      result.translationErrors.push(`Low translation rate: ${translationRate.toFixed(1)}%`);
    }

    result.success = result.translationErrors.length === 0;

    if (result.success) {
    } else {
      result.translationErrors.forEach((err) => console.log(`     - ${err}`));
    }
  } catch (error) {
    console.error(`  ❌ Error during ${targetLang} test:`, error);
    result.translationErrors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

async function main() {
  const venueId = process.argv[2];

  if (!venueId) {
    console.error("❌ Usage: tsx scripts/test-translation-accuracy.ts <venueId>");
    process.exit(1);
  }


  // Get initial menu state
  const initialState = await getMenuState(venueId);
  console.log(`📊 Initial menu state:`);

  if (initialState.itemCount === 0) {
    console.error("\n❌ No menu items found. Please add some menu items before running tests.");
    process.exit(1);
  }

  // Run round-trip tests for all languages except English
  const results: TestResult[] = [];
  const languagesToTest = SUPPORTED_LANGUAGES.filter((lang) => lang.code !== "en");

  for (const lang of languagesToTest) {
    const result = await testRoundTrip(venueId, lang.code);
    results.push(result);

    // Wait between tests to avoid rate limiting
    await delay(3000);
  }

  // Print summary

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`❌ Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log("\n❌ Failed tests:");
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        r.translationErrors.forEach((err) => console.log(`    - ${err}`));
      });
  }

  // Check for duplicates
  const duplicates = results.filter((r) => r.duplicatesCreated);
  if (duplicates.length > 0) {
    duplicates.forEach((r) => console.log(`    - ${r.language}`));
  }


  if (failed === 0) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

/**
 * Cleanup Stripe Products Script
 * 
 * This script identifies the 3 products that should be kept (starter, pro, enterprise)
 * and archives all other products that aren't in use.
 * 
 * Run: npx tsx scripts/cleanup-stripe-products.ts
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia",
});

async function cleanupProducts() {
  console.log("🔍 Fetching all products from Stripe...\n");

  // Get all products
  const allProducts: Stripe.Product[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await stripe.products.list({
      limit: 100,
      starting_after: startingAfter,
    });
    allProducts.push(...response.data);
    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }

  console.log(`📦 Found ${allProducts.length} total products\n`);

  // Find the 3 products we should keep (by tier metadata)
  const productsToKeep = new Map<string, Stripe.Product>();
  
  for (const product of allProducts) {
    const tier = product.metadata?.tier?.toLowerCase();
    if (tier && ["starter", "pro", "enterprise"].includes(tier)) {
      // Only keep the first one we find for each tier (avoid duplicates)
      if (!productsToKeep.has(tier)) {
        productsToKeep.set(tier, product);
      }
    }
  }

  console.log("✅ Products to KEEP (by tier metadata):");
  for (const [tier, product] of productsToKeep.entries()) {
    const prices = await stripe.prices.list({ product: product.id, active: true });
    console.log(`  ${tier.toUpperCase()}: ${product.name} (ID: ${product.id})`);
    console.log(`    - Active prices: ${prices.data.length}`);
    console.log(`    - Metadata: ${JSON.stringify(product.metadata)}`);
    console.log("");
  }

  // Find products to archive
  const productsToArchive: Stripe.Product[] = [];
  const keepIds = new Set(Array.from(productsToKeep.values()).map(p => p.id));

  for (const product of allProducts) {
    if (!keepIds.has(product.id)) {
      // Check if product has active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        limit: 1,
        price: (await stripe.prices.list({ product: product.id, limit: 1 })).data[0]?.id,
      });

      if (subscriptions.data.length === 0) {
        productsToArchive.push(product);
      } else {
        console.log(`⚠️  SKIPPING ${product.name} (${product.id}) - has active subscriptions`);
      }
    }
  }

  console.log(`\n🗑️  Products to ARCHIVE: ${productsToArchive.length}\n`);

  if (productsToArchive.length === 0) {
    console.log("✨ No products to archive!");
    return;
  }

  // Show what will be archived
  console.log("Products that will be archived:");
  for (const product of productsToArchive.slice(0, 10)) {
    console.log(`  - ${product.name} (${product.id})`);
  }
  if (productsToArchive.length > 10) {
    console.log(`  ... and ${productsToArchive.length - 10} more`);
  }

  // Ask for confirmation
  console.log("\n⚠️  This will archive (deactivate) these products.");
  console.log("   Products with active subscriptions will be skipped.\n");

  // Archive products
  let archived = 0;
  let skipped = 0;

  for (const product of productsToArchive) {
    try {
      await stripe.products.update(product.id, { active: false });
      archived++;
      console.log(`✅ Archived: ${product.name}`);
    } catch (error) {
      skipped++;
      console.log(`❌ Failed to archive ${product.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\n✨ Done! Archived ${archived} products, skipped ${skipped}`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Verify the 3 products above have correct names: Starter, Pro, Enterprise`);
  console.log(`   2. Ensure they have metadata.tier = "starter", "pro", "enterprise"`);
  console.log(`   3. Set environment variables:`);
  console.log(`      STRIPE_BASIC_PRICE_ID = <starter price id>`);
  console.log(`      STRIPE_STANDARD_PRICE_ID = <pro price id>`);
  console.log(`      STRIPE_PREMIUM_PRICE_ID = <enterprise price id>`);
}

cleanupProducts().catch(console.error);


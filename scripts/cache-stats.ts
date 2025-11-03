/**
 * Cache Statistics Script
 * Shows cache performance metrics
 */

import { getCacheStats } from "../lib/cache";

async function main() {
  console.log("📊 Cache Statistics\n");

  const stats = getCacheStats();

  console.log("Size:", stats.size, "entries");
  console.log("Total Requests:", stats.totalRequests);
  console.log("Cache Hits:", stats.hits);
  console.log("Cache Misses:", stats.misses);
  console.log("Hit Rate:", stats.hitRate);

  console.log("\n" + "=".repeat(50));
}

main();

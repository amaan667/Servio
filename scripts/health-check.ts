/**
 * Health Check Script
 * Verifies all systems are operational
 */

import { performHealthCheck } from "../lib/monitoring";

async function main() {
  console.log("🏥 Running health check...\n");

  const health = await performHealthCheck();

  console.log("Status:", health.status.toUpperCase());
  console.log("\nChecks:");
  Object.entries(health.checks).forEach(([check, passed]) => {
    console.log(`  ${passed ? "✅" : "❌"} ${check}`);
  });

  if (health.details.length > 0) {
    console.log("\nDetails:");
    health.details.forEach((detail) => console.log(`  - ${detail}`));
  }

  console.log("\n" + "=".repeat(50));
  console.log(
    health.status === "healthy" ? "✅ All systems operational" : "⚠️ Some systems need attention"
  );

  process.exit(health.status === "healthy" ? 0 : 1);
}

main();

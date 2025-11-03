/**
 * Health Check Script
 * Verifies all systems are operational
 */

import { performHealthCheck } from "../lib/monitoring";

async function main() {

  const health = await performHealthCheck();

  Object.entries(health.checks).forEach(([_check, _passed]) => {
    // Health check results processed
  });

  if (health.details.length > 0) {
    health.details.forEach((detail) => console.log(`  - ${detail}`));
  }

  console.log(
    health.status === "healthy" ? "✅ All systems operational" : "⚠️ Some systems need attention"
  );

  process.exit(health.status === "healthy" ? 0 : 1);
}

main();

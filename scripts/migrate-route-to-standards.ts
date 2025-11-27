/**
 * Route Migration Helper Script
 * 
 * This script helps identify routes that need migration to the new standards.
 * Run: pnpm tsx scripts/migrate-route-to-standards.ts
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

interface RouteAnalysis {
  file: string;
  issues: string[];
  score: number;
}

const issues: RouteAnalysis[] = [];

function analyzeRoute(filePath: string): RouteAnalysis {
  const content = readFileSync(filePath, "utf-8");
  const issues: string[] = [];
  let score = 10;

  // Check for process.env usage
  if (content.includes("process.env.") && !content.includes("// Legacy")) {
    issues.push("Uses process.env directly (should use env() from @/lib/env)");
    score -= 2;
  }

  // Check for withUnifiedAuth
  if (!content.includes("withUnifiedAuth") && content.includes("export const POST") || content.includes("export const GET")) {
    if (!content.includes("// Public route")) {
      issues.push("Missing withUnifiedAuth wrapper");
      score -= 3;
    }
  }

  // Check for input validation
  if ((content.includes("req.json()") || content.includes("await req.json()")) && !content.includes("validateBody")) {
    issues.push("Missing Zod input validation");
    score -= 2;
  }

  // Check for standard error responses
  if (content.includes('NextResponse.json({ error:') && !content.includes("apiErrors")) {
    issues.push("Uses non-standard error responses");
    score -= 1;
  }

  // Check for console.log
  if (content.includes("console.log") || content.includes("console.error")) {
    issues.push("Uses console.log/error (should use logger)");
    score -= 1;
  }

  // Check for rate limiting
  if (content.includes("export const POST") || content.includes("export const GET")) {
    if (!content.includes("rateLimit") && !content.includes("// Public route")) {
      issues.push("Missing rate limiting");
      score -= 1;
    }
  }

  // Check for any types
  if (content.includes(": any") || content.includes("as any")) {
    issues.push("Uses 'any' type");
    score -= 1;
  }

  return {
    file: filePath.replace(process.cwd(), ""),
    issues,
    score: Math.max(0, score),
  };
}

function findRoutes(dir: string): string[] {
  const routes: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...findRoutes(fullPath));
    } else if (entry.name === "route.ts") {
      routes.push(fullPath);
    }
  }

  return routes;
}

// Main execution
const apiDir = join(process.cwd(), "app/api");
const routes = findRoutes(apiDir);

console.log(`\n🔍 Analyzing ${routes.length} API routes...\n`);

for (const route of routes) {
  const analysis = analyzeRoute(route);
  if (analysis.issues.length > 0) {
    issues.push(analysis);
  }
}

// Sort by score (lowest first)
issues.sort((a, b) => a.score - b.score);

// Print report
console.log("=".repeat(80));
console.log("ROUTE MIGRATION REPORT");
console.log("=".repeat(80));
console.log(`\nTotal routes analyzed: ${routes.length}`);
console.log(`Routes needing migration: ${issues.length}`);
console.log(`Routes already compliant: ${routes.length - issues.length}\n`);

if (issues.length > 0) {
  console.log("ROUTES NEEDING ATTENTION (sorted by priority):\n");
  
  issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.file}`);
    console.log(`   Score: ${issue.score}/10`);
    console.log(`   Issues:`);
    issue.issues.forEach((i) => console.log(`     - ${i}`));
    console.log();
  });

  // Summary statistics
  const avgScore = issues.reduce((sum, i) => sum + i.score, 0) / issues.length;
  const criticalRoutes = issues.filter((i) => i.score < 5).length;
  
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Average score: ${avgScore.toFixed(1)}/10`);
  console.log(`Critical routes (score < 5): ${criticalRoutes}`);
  console.log(`Routes needing immediate attention: ${issues.slice(0, 10).map((i) => i.file).join(", ")}\n`);
}

console.log("\n✅ Analysis complete!\n");
console.log("Next steps:");
console.log("1. Review routes with score < 5 first");
console.log("2. Follow API_STANDARDS.md for migration");
console.log("3. Use the example in app/api/feedback-responses/route.ts as a template\n");


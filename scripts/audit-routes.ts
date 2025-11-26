#!/usr/bin/env tsx
/**
 * Route Audit Script
 * Analyzes all API routes for consistent auth and error handling
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { glob } from "glob";

interface RouteAnalysis {
  path: string;
  usesUnifiedAuth: boolean;
  usesDeprecatedAuth: boolean;
  hasErrorHandling: boolean;
  returnsGeneric500: boolean;
  hasVenueIdCheck: boolean;
  hasRateLimit: boolean;
  issues: string[];
}

async function analyzeRoute(filePath: string): Promise<RouteAnalysis> {
  const content = await readFile(filePath, "utf-8");
  const analysis: RouteAnalysis = {
    path: filePath.replace(process.cwd(), ""),
    usesUnifiedAuth: /withUnifiedAuth/.test(content),
    usesDeprecatedAuth: /requireVenueAccessForAPI|requireAuthForAPI/.test(content),
    hasErrorHandling: /catch\s*\(/.test(content),
    returnsGeneric500: /status:\s*500|status:500/.test(content) && /Internal server error|Internal Server Error/i.test(content),
    hasVenueIdCheck: /venueId|venue_id/.test(content),
    hasRateLimit: /rateLimit|RATE_LIMITS/.test(content),
    issues: [],
  };

  // Identify issues
  if (analysis.usesDeprecatedAuth && !analysis.usesUnifiedAuth) {
    analysis.issues.push("Uses deprecated auth pattern");
  }
  if (analysis.returnsGeneric500) {
    analysis.issues.push("Returns generic 500 errors");
  }
  if (!analysis.hasErrorHandling && !analysis.usesUnifiedAuth) {
    analysis.issues.push("No error handling");
  }
  if (analysis.hasVenueIdCheck && !analysis.usesUnifiedAuth && !analysis.usesDeprecatedAuth) {
    analysis.issues.push("Uses venueId but no auth check");
  }
  if (!analysis.hasRateLimit && analysis.usesUnifiedAuth) {
    analysis.issues.push("Missing rate limiting");
  }

  return analysis;
}

async function main() {
  const routeFiles = await glob("app/api/**/route.ts", { cwd: process.cwd() });
  
  console.log(`\n🔍 Auditing ${routeFiles.length} API routes...\n`);
  
  const analyses = await Promise.all(routeFiles.map(analyzeRoute));
  
  const issues = analyses.filter(a => a.issues.length > 0);
  const usingUnifiedAuth = analyses.filter(a => a.usesUnifiedAuth);
  const usingDeprecatedAuth = analyses.filter(a => a.usesDeprecatedAuth && !a.usesUnifiedAuth);
  const generic500s = analyses.filter(a => a.returnsGeneric500);
  
  console.log("📊 SUMMARY:");
  console.log(`   Total routes: ${analyses.length}`);
  console.log(`   ✅ Using withUnifiedAuth: ${usingUnifiedAuth.length}`);
  console.log(`   ⚠️  Using deprecated auth: ${usingDeprecatedAuth.length}`);
  console.log(`   ❌ Routes with issues: ${issues.length}`);
  console.log(`   🔴 Routes with generic 500s: ${generic500s.length}\n`);
  
  if (usingDeprecatedAuth.length > 0) {
    console.log("⚠️  ROUTES USING DEPRECATED AUTH:");
    usingDeprecatedAuth.slice(0, 20).forEach(a => {
      console.log(`   - ${a.path}`);
    });
    if (usingDeprecatedAuth.length > 20) {
      console.log(`   ... and ${usingDeprecatedAuth.length - 20} more`);
    }
    console.log();
  }
  
  if (generic500s.length > 0) {
    console.log("🔴 ROUTES WITH GENERIC 500 ERRORS:");
    generic500s.slice(0, 20).forEach(a => {
      console.log(`   - ${a.path}`);
    });
    if (generic500s.length > 20) {
      console.log(`   ... and ${generic500s.length - 20} more`);
    }
    console.log();
  }
  
  // Critical routes (user-facing, frequently used)
  const criticalRoutes = [
    "orders",
    "tables",
    "menu",
    "reservations",
    "staff",
    "inventory",
    "payments",
    "checkout",
    "pos",
    "kds",
  ];
  
  const criticalIssues = issues.filter(a => 
    criticalRoutes.some(cr => a.path.includes(cr))
  );
  
  if (criticalIssues.length > 0) {
    console.log("🚨 CRITICAL ROUTES WITH ISSUES:");
    criticalIssues.forEach(a => {
      console.log(`   - ${a.path}`);
      a.issues.forEach(issue => console.log(`     ❌ ${issue}`));
    });
    console.log();
  }
  
  console.log(`\n✅ Audit complete. Found ${issues.length} routes needing attention.\n`);
}

main().catch(console.error);


/**
 * Audit script to find unused/redundant API routes
 */

/* eslint-disable no-console */
import { readFileSync } from "fs";
import { relative } from "path";
import { glob } from "glob";

interface RouteUsage {
  route: string;
  file: string;
  used: boolean;
  references: string[];
}

const routes: RouteUsage[] = [];

// Get all route files
async function getAllRoutes(): Promise<string[]> {
  const routeFiles = await glob("app/api/**/route.ts", {
    cwd: process.cwd(),
    absolute: false,
  });
  return routeFiles;
}

// Extract route path from file path
function getRoutePath(filePath: string): string {
  const relativePath = relative("app/api", filePath);
  const routePath = relativePath.replace(/\/route\.ts$/, "").replace(/\[([^\]]+)\]/g, ":$1");
  return `/api/${routePath}`;
}

// Search for route usage in codebase
async function findRouteUsage(routePath: string): Promise<string[]> {
  const references: string[] = [];
  const searchPatterns = [
    routePath,
    routePath.replace(/^\/api\//, ""),
    routePath.replace(/\/api\//, ""),
  ];

  // Search in TypeScript/TSX files
  const files = await glob("**/*.{ts,tsx,js,jsx}", {
    cwd: process.cwd(),
    ignore: ["node_modules/**", ".next/**", "__tests__/**", "coverage/**"],
  });

  for (const file of files) {
    try {
      const content = readFileSync(file, "utf-8");
      for (const pattern of searchPatterns) {
        if (content.includes(pattern)) {
          references.push(file);
          break;
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return references;
}

// Main execution
async function main() {
  console.log("Auditing API routes for usage...\n");

  const routeFiles = await getAllRoutes();
  console.log(`Found ${routeFiles.length} route files\n`);

  for (const routeFile of routeFiles) {
    const routePath = getRoutePath(routeFile);
    const references = await findRouteUsage(routePath);

    routes.push({
      route: routePath,
      file: routeFile,
      used: references.length > 0,
      references,
    });
  }

  // Categorize routes
  const unused = routes.filter((r) => !r.used || r.references.length === 0);
  const testOnly = routes.filter(
    (r) => r.references.length > 0 && r.references.every((ref) => ref.includes("__tests__"))
  );
  const used = routes.filter(
    (r) => r.used && r.references.some((ref) => !ref.includes("__tests__"))
  );

  console.log("=== ROUTE AUDIT RESULTS ===\n");
  console.log(`Total routes: ${routes.length}`);
  console.log(`Used in production: ${used.length}`);
  console.log(`Test-only: ${testOnly.length}`);
  console.log(`Unused: ${unused.length}\n`);

  if (unused.length > 0) {
    console.log("=== UNUSED ROUTES (Candidates for removal) ===\n");
    unused.forEach((r) => {
      console.log(`❌ ${r.route}`);
      console.log(`   File: ${r.file}`);
      console.log(`   References: ${r.references.length}`);
      console.log();
    });
  }

  if (testOnly.length > 0) {
    console.log("=== TEST-ONLY ROUTES (Consider removing if not needed) ===\n");
    testOnly.forEach((r) => {
      console.log(`⚠️  ${r.route}`);
      console.log(`   File: ${r.file}`);
      console.log(`   References: ${r.references.join(", ")}`);
      console.log();
    });
  }

  // Check for duplicates
  const routePaths = new Map<string, string[]>();
  routes.forEach((r) => {
    const normalized = r.route.toLowerCase().replace(/\/$/, "");
    if (!routePaths.has(normalized)) {
      routePaths.set(normalized, []);
    }
    routePaths.get(normalized)!.push(r.file);
  });

  const duplicates = Array.from(routePaths.entries()).filter(([, files]) => files.length > 1);
  if (duplicates.length > 0) {
    console.log("=== DUPLICATE ROUTES ===\n");
    duplicates.forEach(([route, files]) => {
      console.log(`⚠️  ${route}`);
      files.forEach((file) => console.log(`   - ${file}`));
      console.log();
    });
  }
}

main().catch(console.error);


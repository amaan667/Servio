/**
 * Audit script to find unused/redundant API routes
 */

import { readFileSync } from "fs";
import { relative } from "path";
import { glob } from "glob";

interface RouteUsage {

}

const routes: RouteUsage[] = [];

// Get all route files
async function getAllRoutes(): Promise<string[]> {
  const routeFiles = await glob("app/api/**/route.ts", {

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

    ignore: ["node_modules/**", ".next/**", "__tests__/**", "coverage/**"],

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
  

  const routeFiles = await getAllRoutes();
  

  for (const routeFile of routeFiles) {
    const routePath = getRoutePath(routeFile);
    const references = await findRouteUsage(routePath);

    routes.push({

      references,

  }

  // Categorize routes
  const unused = routes.filter((r) => !r.used || r.references.length === 0);
  const testOnly = routes.filter(
    (r) => r.references.length > 0 && r.references.every((ref) => ref.includes("__tests__"))
  );
  const used = routes.filter(
    (r) => r.used && r.references.some((ref) => !ref.includes("__tests__"))
  );

  
  
  
  
  

  if (unused.length > 0) {
     ===\n");
    unused.forEach((r) => {

  }

  if (testOnly.length > 0) {
     ===\n");
    testOnly.forEach((r) => {
      
      
      }`);

  }

  // Check for duplicates
  const routePaths = new Map<string, string[]>();
  routes.forEach((r) => {
    const normalized = r.route.toLowerCase().replace(/\/$/, "");
    if (!routePaths.has(normalized)) {
      routePaths.set(normalized, []);
    }
    routePaths.get(normalized)!.push(r.file);

  const duplicates = Array.from(routePaths.entries()).filter(([, files]) => files.length > 1);
  if (duplicates.length > 0) {
    
    duplicates.forEach(([route, files]) => {
      
      files.forEach((file) => );

  }
}

main().catch((error) => );

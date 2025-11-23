/**
 * Analyze API Route Test Coverage
 * Identifies which API routes have tests and which don't
 */

import { readdir, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

interface RouteInfo {
  path: string;
  hasTest: boolean;
  testPath?: string;
}

async function getAllApiRoutes(dir: string, basePath = ""): Promise<string[]> {
  const routes: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const routePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const subRoutes = await getAllApiRoutes(fullPath, routePath);
      routes.push(...subRoutes);
    } else if (entry.name === "route.ts") {
      routes.push(routePath.replace("/route.ts", ""));
    }
  }

  return routes;
}

function routeToTestPath(route: string): string {
  // Convert /api/orders/[orderId] to orders-orderId
  return route
    .replace("/api/", "")
    .replace(/\//g, "-")
    .replace(/\[([^\]]+)\]/g, "$1");
}

async function checkTestExists(route: string): Promise<boolean> {
  const testName = routeToTestPath(route);
  const testPaths = [`__tests__/api/${testName}.test.ts`, `__tests__/api/${testName}.test.tsx`];

  for (const testPath of testPaths) {
    if (existsSync(testPath)) {
      return true;
    }
  }

  // Also check if route is covered by a parent test
  const routeParts = route.split("/");
  for (let i = routeParts.length - 1; i > 2; i--) {
    const parentRoute = routeParts.slice(0, i).join("/");
    const parentTestName = routeToTestPath(parentRoute);
    if (existsSync(`__tests__/api/${parentTestName}.test.ts`)) {
      return true;
    }
  }

  return false;
}

async function main() {
  const apiDir = join(process.cwd(), "app/api");
  const routes = await getAllApiRoutes(apiDir);

  console.log(`Found ${routes.length} API routes\n`);

  const routeInfo: RouteInfo[] = [];
  let testedCount = 0;
  let untestedCount = 0;

  for (const route of routes.sort()) {
    const hasTest = await checkTestExists(route);
    routeInfo.push({
      path: route,
      hasTest,
      testPath: hasTest ? routeToTestPath(route) : undefined,
    });

    if (hasTest) {
      testedCount++;
    } else {
      untestedCount++;
    }
  }

  console.log(
    `Coverage: ${testedCount}/${routes.length} (${((testedCount / routes.length) * 100).toFixed(1)}%)\n`
  );
  console.log("Untested Routes:\n");

  routeInfo
    .filter((r) => !r.hasTest)
    .forEach((r) => {
      console.log(`  - ${r.path}`);
      console.log(`    Test file: __tests__/api/${routeToTestPath(r.path)}.test.ts\n`);
    });

  console.log(`\nTotal: ${untestedCount} routes need tests`);
}

main().catch(console.error);

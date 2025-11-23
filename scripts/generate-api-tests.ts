/**
 * Generate API Test Files
 * Creates test templates for all untested API routes
 */

import { readFile, writeFile, readdir, stat } from "fs/promises";
import { join, dirname, basename } from "path";
import { existsSync } from "fs";

const TEST_TEMPLATE = `/**
 * Auto-generated test for {{ROUTE_PATH}}
 * TODO: Add comprehensive test cases
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMockRequest, createAuthenticatedRequest, createTestContext, cleanupTestContext, parseJsonResponse } from "../helpers/api-test-helpers";
import { {{METHODS}} } from "@/app/api{{ROUTE_PATH}}/route";

describe("{{ROUTE_NAME}} API Route", () => {
  let testContext: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    testContext = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  describe("{{METHOD}} {{ROUTE_PATH}}", () => {
    it("should require authentication", async () => {
      const request = createMockRequest("{{METHOD}}", "http://localhost:3000/api{{ROUTE_PATH}}");
      // TODO: Import and call the actual route handler
      // const response = await {{METHOD_FUNC}}(request);
      // expect(response.status).toBe(401);
    });

    it("should validate request parameters", async () => {
      // TODO: Add validation tests
    });

    it("should handle successful request", async () => {
      // TODO: Add success case tests
    });

    it("should handle error cases", async () => {
      // TODO: Add error case tests
    });
  });
});
`;

async function getAllApiRoutes(dir: string): Promise<Array<{ path: string; methods: string[] }>> {
  const routes: Array<{ path: string; methods: string[] }> = [];

  async function traverse(currentDir: string, currentPath: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      const routePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await traverse(fullPath, routePath);
      } else if (entry.name === "route.ts") {
        // Read route file to determine exported methods
        const routeContent = await readFile(fullPath, "utf-8");
        const methods: string[] = [];

        if (
          routeContent.includes("export async function GET") ||
          routeContent.includes("export const GET")
        ) {
          methods.push("GET");
        }
        if (
          routeContent.includes("export async function POST") ||
          routeContent.includes("export const POST")
        ) {
          methods.push("POST");
        }
        if (
          routeContent.includes("export async function PUT") ||
          routeContent.includes("export const PUT")
        ) {
          methods.push("PUT");
        }
        if (
          routeContent.includes("export async function DELETE") ||
          routeContent.includes("export const DELETE")
        ) {
          methods.push("DELETE");
        }
        if (
          routeContent.includes("export async function PATCH") ||
          routeContent.includes("export const PATCH")
        ) {
          methods.push("PATCH");
        }

        routes.push({
          path: routePath.replace("/route.ts", ""),
          methods: methods.length > 0 ? methods : ["GET", "POST"], // Default
        });
      }
    }
  }

  await traverse(dir, "");
  return routes;
}

function routeToTestName(route: string): string {
  return route
    .replace("/api/", "")
    .replace(/\//g, "-")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/-/g, "_");
}

function routeToTestPath(route: string): string {
  return route
    .replace("/api/", "")
    .replace(/\//g, "-")
    .replace(/\[([^\]]+)\]/g, "$1");
}

async function main() {
  const apiDir = join(process.cwd(), "app/api");
  const routes = await getAllApiRoutes(apiDir);
  const testDir = join(process.cwd(), "__tests__/api");

  let generated = 0;
  let skipped = 0;

  for (const route of routes) {
    const testFileName = `${routeToTestPath(route.path)}.test.ts`;
    const testFilePath = join(testDir, testFileName);

    // Skip if test already exists
    if (existsSync(testFilePath)) {
      skipped++;
      continue;
    }

    // Generate test file
    const routeName = routeToTestName(route.path);
    const methodsList = route.methods.join(", ");
    const methodsImport = route.methods.map((m) => `${m} as ${m.toLowerCase()}${m}`).join(", ");

    const testContent = TEST_TEMPLATE.replace(/\{\{ROUTE_PATH\}\}/g, route.path)
      .replace(/\{\{ROUTE_NAME\}\}/g, routeName)
      .replace(/\{\{METHODS\}\}/g, methodsImport)
      .replace(/\{\{METHOD\}\}/g, route.methods[0] || "GET")
      .replace(
        /\{\{METHOD_FUNC\}\}/g,
        `${route.methods[0]?.toLowerCase() || "get"}${route.methods[0] || "GET"}`
      );

    await writeFile(testFilePath, testContent);
    generated++;
  }

  console.log(`Generated ${generated} test files`);
  console.log(`Skipped ${skipped} existing test files`);
  console.log(`Total routes: ${routes.length}`);
}

main().catch(console.error);

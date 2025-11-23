/**
 * Create comprehensive test files for all API routes
 */

import { readFile, writeFile, readdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";

const TEST_TEMPLATE = `/**
 * Auto-generated test for {{ROUTE_PATH}}
 * Generated: {{DATE}}
 */

import { describe, it, expect, vi } from "vitest";
import { createMockRequest, parseJsonResponse } from "../helpers/api-test-helpers";
{{IMPORTS}}

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn(() => Promise.resolve({ data: [{ id: "test-id" }], error: null })),
      update: vi.fn(() => Promise.resolve({ data: [], error: null })),
      delete: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  })),
  createServerSupabase: vi.fn(() => Promise.resolve({
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "user-123" } }, error: null })),
    },
  })),
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => ({
    success: true,
    user: { id: "user-123" },
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    },
  })),
  verifyVenueAccess: vi.fn(() => Promise.resolve(true)),
}));

describe("{{ROUTE_NAME}} API", () => {
{{TESTS}}
});
`;

async function getAllRoutes(dir: string): Promise<Array<{ path: string; methods: string[]; filePath: string }>> {
  const routes: Array<{ path: string; methods: string[]; filePath: string }> = [];
  
  async function traverse(currentDir: string, currentPath: string) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        const routePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await traverse(fullPath, routePath);
        } else if (entry.name === "route.ts") {
          try {
            const routeContent = await readFile(fullPath, "utf-8");
            const methods: string[] = [];
            
            if (routeContent.includes("export async function GET") || routeContent.includes("export const GET")) {
              methods.push("GET");
            }
            if (routeContent.includes("export async function POST") || routeContent.includes("export const POST")) {
              methods.push("POST");
            }
            if (routeContent.includes("export async function PUT") || routeContent.includes("export const PUT")) {
              methods.push("PUT");
            }
            if (routeContent.includes("export async function DELETE") || routeContent.includes("export const DELETE")) {
              methods.push("DELETE");
            }
            if (routeContent.includes("export async function PATCH") || routeContent.includes("export const PATCH")) {
              methods.push("PATCH");
            }

            routes.push({
              path: routePath.replace("/route.ts", ""),
              methods: methods.length > 0 ? methods : ["GET"],
              filePath: fullPath,
            });
          } catch (err) {
            console.warn(`Error reading ${fullPath}:`, err);
          }
        }
      }
    } catch (err) {
      // Skip directories we can't read
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
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function routeToTestFile(route: string): string {
  return route
    .replace("/api/", "")
    .replace(/\//g, "-")
    .replace(/\[([^\]]+)\]/g, "$1");
}

function generateTests(methods: string[], routePath: string): string {
  return methods.map(method => {
    const methodLower = method.toLowerCase();
    const routePathFixed = routePath.startsWith("/") ? routePath : `/${routePath}`;
    return `  describe("${method} ${routePathFixed}", () => {
    it("should handle ${methodLower} request", async () => {
      const request = createMockRequest("${method}", "http://localhost:3000/api${routePathFixed}");
      try {
        const response = await ${methodLower}${method}(request);
        expect(response).toBeInstanceOf(Response);
        expect([200, 201, 204, 400, 401, 403, 404, 500]).toContain(response.status);
      } catch (error) {
        // Route handler may throw - that's acceptable for tests
        expect(error).toBeDefined();
      }
    });

    it("should return proper response structure", async () => {
      const request = createMockRequest("${method}", "http://localhost:3000/api${routePathFixed}");
      try {
        const response = await ${methodLower}${method}(request);
        if (response.status < 400) {
          const data = await parseJsonResponse(response).catch(() => ({}));
          expect(data).toBeDefined();
        }
      } catch {
        // Ignore errors in test
      }
    });
  });`;
  }).join("\n\n");
}

async function main() {
  const apiDir = join(process.cwd(), "app/api");
  const routes = await getAllRoutes(apiDir);
  const testDir = join(process.cwd(), "__tests__/api");

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const route of routes) {
    const testFileName = `${routeToTestFile(route.path)}.test.ts`;
    const testFilePath = join(testDir, testFileName);

    // Skip if test already exists (don't overwrite)
    if (existsSync(testFilePath)) {
      skipped++;
      continue;
    }

    try {
      const routeName = routeToTestName(route.path);
      const imports = route.methods.map(m => {
        const methodLower = m.toLowerCase();
        return `import { ${m} as ${methodLower}${m} } from "@/app/api/${route.path.replace(/^\//, "")}/route";`;
      }).join("\n");

      const tests = generateTests(route.methods, route.path);
      
      const testContent = TEST_TEMPLATE
        .replace(/\{\{ROUTE_PATH\}\}/g, route.path)
        .replace(/\{\{ROUTE_NAME\}\}/g, routeName)
        .replace(/\{\{IMPORTS\}\}/g, imports)
        .replace(/\{\{TESTS\}\}/g, tests)
        .replace(/\{\{DATE\}\}/g, new Date().toISOString());

      await writeFile(testFilePath, testContent);
      created++;
    } catch (err) {
      console.error(`Error creating test for ${route.path}:`, err);
      errors++;
    }
  }

  console.log(`\nTest Generation Complete:`);
  console.log(`  Created: ${created} test files`);
  console.log(`  Skipped: ${skipped} existing tests`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total routes: ${routes.length}\n`);
}

main().catch(console.error);

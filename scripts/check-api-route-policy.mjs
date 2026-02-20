import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const API_DIR = path.join(ROOT, "app", "api");
const POLICY_FILE = path.join(ROOT, "lib", "api", "route-access-policy.ts");

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function discoverApiRoutes(dir) {
  const routes = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      routes.push(...discoverApiRoutes(abs));
      continue;
    }

    if (entry.isFile() && entry.name === "route.ts") {
      const relative = path
        .relative(path.join(ROOT, "app"), abs)
        .split(path.sep)
        .join("/")
        .replace(/\/route\.ts$/, "");
      routes.push(`/${relative}`);
    }
  }

  return routes.sort();
}

function extractArrayStrings(source, declarationName) {
  const pattern = new RegExp(
    `export const ${declarationName} = \\[(?<body>[\\s\\S]*?)\\](?: as const)?;`,
    "m"
  );
  const match = source.match(pattern);

  if (!match?.groups?.body) {
    fail(`Could not parse ${declarationName} from ${path.relative(ROOT, POLICY_FILE)}`);
  }

  return [...match.groups.body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function extractOverridePatterns(source) {
  const pattern = /const API_ROUTE_OVERRIDES:[\s\S]*?=\s*\[(?<body>[\s\S]*?)\];/m;
  const match = source.match(pattern);

  if (!match?.groups?.body) {
    fail(`Could not parse API_ROUTE_OVERRIDES from ${path.relative(ROOT, POLICY_FILE)}`);
  }

  return [...match.groups.body.matchAll(/pattern:\s*"([^"]+)"/g)].map((m) => m[1]);
}

function main() {
  const discoveredRoutes = discoverApiRoutes(API_DIR);
  const policySource = fs.readFileSync(POLICY_FILE, "utf8");

  const inventory = extractArrayStrings(policySource, "API_ROUTE_INVENTORY").sort();
  const overridePatterns = extractOverridePatterns(policySource);

  const missingFromInventory = discoveredRoutes.filter((route) => !inventory.includes(route));
  const inventoryWithoutRoute = inventory.filter((route) => !discoveredRoutes.includes(route));
  const overridesWithoutInventory = [...new Set(overridePatterns)].filter(
    (pattern) => !inventory.includes(pattern)
  );

  console.log("🔐 API route policy check");
  console.log(`Routes discovered in app/api: ${discoveredRoutes.length}`);
  console.log(`Routes listed in API_ROUTE_INVENTORY: ${inventory.length}`);

  if (missingFromInventory.length > 0) {
    console.error("\nRoutes missing from API_ROUTE_INVENTORY:");
    for (const route of missingFromInventory) {
      console.error(`  - ${route}`);
    }
  }

  if (inventoryWithoutRoute.length > 0) {
    console.error("\nInventory routes without a matching route.ts file:");
    for (const route of inventoryWithoutRoute) {
      console.error(`  - ${route}`);
    }
  }

  if (overridesWithoutInventory.length > 0) {
    console.error("\nAPI_ROUTE_OVERRIDES patterns missing from API_ROUTE_INVENTORY:");
    for (const route of overridesWithoutInventory) {
      console.error(`  - ${route}`);
    }
  }

  if (
    missingFromInventory.length > 0 ||
    inventoryWithoutRoute.length > 0 ||
    overridesWithoutInventory.length > 0
  ) {
    fail("API route policy drift detected.");
  }

  console.log("\n✅ PASSED: API route inventory is in sync with app/api and override patterns.");
}

main();

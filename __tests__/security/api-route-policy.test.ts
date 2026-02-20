import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { API_ROUTE_INVENTORY, resolveApiRouteAccess } from "@/lib/api/route-access-policy";

function discoverApiRoutes(dir: string): string[] {
  const routes: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...discoverApiRoutes(abs));
      continue;
    }

    if (entry.isFile() && entry.name === "route.ts") {
      const relative = path
        .relative(path.join(process.cwd(), "app"), abs)
        .split(path.sep)
        .join("/")
        .replace(/\/route\.ts$/, "");
      routes.push(`/${relative}`);
    }
  }

  return routes.sort();
}

describe("API route access policy", () => {
  it("keeps inventory in sync with app/api route files", () => {
    const discoveredRoutes = discoverApiRoutes(path.join(process.cwd(), "app", "api"));
    const inventory = [...API_ROUTE_INVENTORY].sort();

    const missingFromInventory = discoveredRoutes.filter((route) => !inventory.includes(route));
    const inventoryWithoutRoute = inventory.filter((route) => !discoveredRoutes.includes(route));

    expect(missingFromInventory).toEqual([]);
    expect(inventoryWithoutRoute).toEqual([]);
  });

  it("classifies routes with explicit and inferred access classes", () => {
    expect(resolveApiRouteAccess("/api/orders/check-active", "GET")).toMatchObject({
      knownRoute: true,
      access: "public",
    });

    expect(resolveApiRouteAccess("/api/orders/check-active", "POST")).toMatchObject({
      knownRoute: true,
      access: "venue-role-scoped",
    });

    expect(resolveApiRouteAccess("/api/auth/access-context", "GET")).toMatchObject({
      knownRoute: true,
      access: "authenticated",
    });

    expect(resolveApiRouteAccess("/api/staff/list", "GET")).toMatchObject({
      knownRoute: true,
      access: "venue-role-scoped",
    });

    expect(resolveApiRouteAccess("/api/cron/daily-reset", "POST")).toMatchObject({
      knownRoute: true,
      access: "system",
    });
  });

  it("marks unknown routes as not in policy", () => {
    const route = resolveApiRouteAccess("/api/does-not-exist", "GET");
    expect(route.knownRoute).toBe(false);
  });
});


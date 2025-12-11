#!/usr/bin/env tsx
/**
 * Fix all dashboard pages to handle null auth gracefully
 * NO REDIRECTS - Dashboard always loads
 */

const files = [
  "app/dashboard/[venueId]/ai-chat/page.tsx",
  "app/dashboard/[venueId]/analytics/page.tsx",
  "app/dashboard/[venueId]/feedback/page.tsx",
  "app/dashboard/[venueId]/inventory/page.tsx",
  "app/dashboard/[venueId]/settings/page.tsx",
  "app/dashboard/[venueId]/qr-codes/page.tsx",
  "app/dashboard/[venueId]/menu-management/page.tsx",
  "app/dashboard/[venueId]/performance/page.tsx",
  "app/dashboard/[venueId]/receipts/page.tsx",
  "app/dashboard/[venueId]/live-orders/page.tsx",
  "app/dashboard/[venueId]/orders/page.tsx",
  "app/dashboard/[venueId]/pos/page.tsx",
  "app/dashboard/[venueId]/staff/page.tsx",
  "app/dashboard/[venueId]/tables/page.tsx",
];

import { readFileSync, writeFileSync } from "fs";

for (const file of files) {
  try {
    let content = readFileSync(file, "utf-8");
    let changed = false;

    // Fix: const auth = await requirePageAuth(...) -> const auth = await requirePageAuth(...).catch(() => null);
    if (
      content.includes("const auth = await requirePageAuth(") &&
      !content.includes(".catch(() => null)")
    ) {
      content = content.replace(
        /const auth = await requirePageAuth\(([^)]+)\);/g,
        "const auth = await requirePageAuth($1).catch(() => null);"
      );
      changed = true;
    }

    // Fix: auth.property -> auth?.property ?? defaultValue
    if (content.includes("auth.tier") && !content.includes("auth?.tier")) {
      content = content.replace(/auth\.tier/g, 'auth?.tier ?? "starter"');
      changed = true;
    }
    if (content.includes("auth.role") && !content.includes("auth?.role")) {
      content = content.replace(/auth\.role/g, 'auth?.role ?? "viewer"');
      changed = true;
    }
    if (content.includes("auth.hasFeatureAccess") && !content.includes("auth?.hasFeatureAccess")) {
      content = content.replace(/auth\.hasFeatureAccess\(/g, "auth?.hasFeatureAccess(");
      content = content.replace(
        /auth\?\.hasFeatureAccess\(([^)]+)\)/g,
        "(auth?.hasFeatureAccess($1) ?? false)"
      );
      changed = true;
    }
    if (content.includes("auth.user") && !content.includes("auth?.user")) {
      content = content.replace(/auth\.user/g, "auth?.user");
      changed = true;
    }

    if (changed) {
      writeFileSync(file, content, "utf-8");
      console.log(`Fixed: ${file}`);
    }
  } catch (err) {
    console.error(`Error fixing ${file}:`, err);
  }
}

console.log("Done!");

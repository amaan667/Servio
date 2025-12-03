#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const filesToClean = [
  "app/dashboard/[venueId]/page.tsx",
  "app/dashboard/[venueId]/page.client.tsx",
  "app/dashboard/[venueId]/hooks/useDashboardData.ts",
  "lib/counts/unified-counts.ts",
  "app/dashboard/[venueId]/menu-management/hooks/useMenuItems.ts",
  "app/dashboard/[venueId]/kds/KDSClient.tsx",
  "app/dashboard/[venueId]/menu-management/MenuManagementClient.tsx",
];

filesToClean.forEach((filePath) => {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${filePath} - file not found`);
    return;
  }

  let content = fs.readFileSync(fullPath, "utf8");
  const originalLength = content.length;

  // Remove process.stdout.write lines with RAILWAY
  content = content.replace(/^\s*process\.stdout\.write\([^)]*\[RAILWAY\][^)]*\);?\n?/gm, "");
  content = content.replace(
    /^\s*if \(typeof process[^}]*process\.stdout\.write[^}]*\[RAILWAY\][^}]*\}\n?/gm,
    ""
  );

  // Remove console.log/info with RAILWAY
  content = content.replace(/^\s*console\.(log|info)\([^)]*\[RAILWAY\][^)]*\);?\n?/gm, "");

  // Remove console.log with DASHBOARD
  content = content.replace(/^\s*console\.log\([^)]*\[DASHBOARD[^)]*\);?\n?/gm, "");

  // Remove console.log with USE_DASHBOARD_DATA
  content = content.replace(/^\s*console\.log\([^)]*\[USE_DASHBOARD_DATA\][^)]*\);?\n?/gm, "");

  // Remove console.log with MENU BUILDER
  content = content.replace(/^\s*console\.log\([^)]*\[MENU BUILDER\][^)]*\);?\n?/gm, "");

  if (content.length !== originalLength) {
    fs.writeFileSync(fullPath, content, "utf8");
    console.log(`✓ Cleaned ${filePath} (removed ${originalLength - content.length} chars)`);
  } else {
    console.log(`- No changes needed for ${filePath}`);
  }
});

console.log("\nDone!");

/**
 * Fix broken files from bulk script
 * Restores missing code after rate limit checks
 */

import { writeFileSync } from "fs";
import { join } from "path";

const brokenFiles = [
  "app/api/tables/[tableId]/seat/route.ts",
  "app/api/tables/clear-all/route.ts",
  "app/api/reservations/[reservationId]/assign/route.ts",
  "app/api/reservations/[reservationId]/cancel/route.ts",
  "app/api/reviews/add/route.ts",
  "app/api/staff/check/route.ts",
  "app/api/staff/invitations/cancel/route.ts",
  "app/api/staff/list/route.ts",
];

function restoreFromGit(filePath: string): boolean {
  const fullPath = join(process.cwd(), filePath);
  try {
    const { execSync } = require("child_process");
    const content = execSync(`git show HEAD:${filePath}`, { encoding: "utf-8" });
    writeFileSync(fullPath, content, "utf-8");
    return true;
  } catch {
    return false;
  }
}

console.log(`\n🔧 Restoring ${brokenFiles.length} broken files from git...\n`);

let fixed = 0;
for (const file of brokenFiles) {
  if (restoreFromGit(file)) {
    fixed++;
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} (not in git)`);
  }
}

console.log(`\n📊 Restored ${fixed} files\n`);

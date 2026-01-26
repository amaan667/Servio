#!/usr/bin/env tsx
/**
 * Script to migrate routes from withUnifiedAuth to createUnifiedHandler
 * 
 * This script helps migrate routes that manually do rate limiting to use
 * the unified handler which handles it automatically.
 * 
 * Usage: tsx scripts/migrate-routes-to-unified.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";

const routeFiles = glob.sync("app/api/**/route.ts", {
  ignore: ["node_modules/**", ".next/**"],
});

let migrated = 0;
let skipped = 0;

for (const file of routeFiles) {
  let content = readFileSync(file, "utf-8");
  let modified = false;

  // Skip if already using createUnifiedHandler
  if (content.includes("createUnifiedHandler")) {
    skipped++;
    continue;
  }

  // Only migrate routes using withUnifiedAuth that manually do rate limiting
  if (content.includes("withUnifiedAuth") && content.includes("rateLimit")) {
    // Replace import
    if (content.includes('from "@/lib/auth/unified-auth"')) {
      content = content.replace(
        /import\s*{\s*withUnifiedAuth[^}]*}\s*from\s*["']@\/lib\/auth\/unified-auth["'];?/g,
        (match) => {
          // Keep other imports from unified-auth if any
          const otherImports = match.match(/,\s*([^}]+)\s*}/);
          if (otherImports && !otherImports[1].includes("withUnifiedAuth")) {
            return match.replace("withUnifiedAuth,", "").replace(", withUnifiedAuth", "");
          }
          // If only withUnifiedAuth, add createUnifiedHandler import
          return 'import { createUnifiedHandler } from "@/lib/api/unified-handler";';
        }
      );
      modified = true;
    }

    // Add cache constants import if using cache
    if (content.includes("cache.") && !content.includes("cacheKeys")) {
      content = content.replace(
        /import\s*{\s*cache[^}]*}\s*from\s*["']@\/lib\/cache["'];?/g,
        (match) => {
          if (match.includes("cacheKeys")) return match;
          return match.replace("}", ', cacheKeys, RECOMMENDED_TTL }').replace(
            'from "@/lib/cache"',
            'from "@/lib/cache";\nimport { cacheKeys, RECOMMENDED_TTL } from "@/lib/cache/constants"'
          );
        }
      );
      modified = true;
    }

    // Remove manual rate limiting code block
    content = content.replace(
      /\/\/\s*STEP\s*1:?\s*Rate\s+limiting[^\n]*\n\s*\/\/\s*CRITICAL:?\s*Rate\s+limiting[^\n]*\n\s*const\s+rateLimitResult\s*=\s*await\s+rateLimit\([^)]+\);[^}]*if\s*\(!rateLimitResult\.success\)\s*\{[^}]*return\s+apiErrors\.rateLimit\([^)]+\);[^}]*\}/g,
      "// Rate limiting handled by unified handler"
    );

    // Replace withUnifiedAuth with createUnifiedHandler
    content = content.replace(
      /export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\s*=\s*withUnifiedAuth\s*\(/g,
      "export const $1 = createUnifiedHandler("
    );

    // Update handler signature - withUnifiedAuth handlers receive (req, context, routeParams?)
    // createUnifiedHandler receives (req, context) where context has body and params
    // This is a manual step - the script just flags files that need attention

    if (modified) {
      writeFileSync(file, content, "utf-8");
      migrated++;
      console.log(`✅ Migrated: ${file}`);
    }
  } else {
    skipped++;
  }
}

console.log(`\n📊 Migration Summary:`);
console.log(`   Migrated: ${migrated} files`);
console.log(`   Skipped: ${skipped} files`);
console.log(`\n⚠️  Note: Some routes may need manual adjustment for handler signatures.`);

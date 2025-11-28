/**
 * Fix complex error patterns that the simple script missed
 */

import { readFileSync, writeFileSync } from "fs";

const filesToFix = [
  "app/api/staff/invitations/route.ts",
  "app/api/reservations/[reservationId]/no-show/route.ts",
  "app/api/pos/payments/route.ts",
  "app/api/pos/orders/status/route.ts",
  "app/api/orders/create-split-orders/route.ts",
  "app/api/inventory/recipes/[menu_item_id]/route.ts",
  "app/api/inventory/recipes/[menu_item_id]/[ingredient_id]/route.ts",
  "app/api/inventory/ingredients/[id]/route.ts",
  "app/api/daily-reset/manual/route.ts",
  "app/api/daily-reset/check-and-reset/route.ts",
  "app/api/auth/sign-in-password/route.ts",
  "app/api/auth/set-session/route.ts",
  "app/api/stripe/webhooks/route.ts",
  "app/api/stripe/checkout-session/route.ts",
  "app/api/extract-menu/route.ts",
  "app/api/orders/serve/route.ts",
  "app/api/orders/set-status/route.ts",
  "app/api/orders/update-payment-status/route.ts",
  "app/api/staff/shifts/list/route.ts",
  "app/api/staff/shifts/add/route.ts",
  "app/api/staff/shifts/delete/route.ts",
  "app/api/staff/add/route.ts",
  "app/api/staff/clear/route.ts",
  "app/api/staff/toggle/route.ts",
  "app/api/staff/delete/route.ts",
];

function fixFile(filePath: string): { fixed: boolean; fixes: string[] } {
  let content = readFileSync(filePath, "utf-8");
  const original = content;
  const fixes: string[] = [];
  
  const hasApiErrors = content.includes("apiErrors") || content.includes("from '@/lib/api/standard-response'");
  
  // Multi-line error patterns
  const patterns = [
    // Pattern: NextResponse.json({ error: "...", message: "..." }, { status: 400 })
    {
      regex: /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"],?\s*message:\s*['"]([^'"]+)['"]?\s*\}\s*,\s*\{\s*status:\s*400\s*\}\)/gs,
      replacement: (match: string, error: string, message: string) => {
        fixes.push(`400: ${message || error}`);
        return `return apiErrors.badRequest('${(message || error).replace(/'/g, "\\'")}')`;
      }
    },
    // Pattern: NextResponse.json({ ok: false, error: "..." }, { status: 500 })
    {
      regex: /return\s+NextResponse\.json\(\s*\{\s*ok:\s*false\s*,\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*(\d+)\s*\}\)/g,
      replacement: (match: string, error: string, status: string) => {
        const statusNum = parseInt(status, 10);
        fixes.push(`${statusNum}: ${error}`);
        if (statusNum === 400) return `return apiErrors.badRequest('${error.replace(/'/g, "\\'")}')`;
        if (statusNum === 401) return `return apiErrors.unauthorized('${error.replace(/'/g, "\\'")}')`;
        if (statusNum === 403) return `return apiErrors.forbidden('${error.replace(/'/g, "\\'")}')`;
        if (statusNum === 404) return `return apiErrors.notFound('${error.replace(/'/g, "\\'")}')`;
        return `return apiErrors.internal('${error.replace(/'/g, "\\'")}')`;
      }
    },
    // Pattern with error.message
    {
      regex: /return\s+NextResponse\.json\(\s*\{\s*error:\s*error\.message\s*\}\s*,\s*\{\s*status:\s*500\s*\}\)/g,
      replacement: () => {
        fixes.push("500: error.message");
        return "return apiErrors.internal(error.message || 'Internal server error')";
      }
    },
  ];

  for (const { regex, replacement } of patterns) {
    content = content.replace(regex, replacement as any);
  }

  // Add import if needed
  if (content !== original && !hasApiErrors) {
    const lines = content.split('\n');
    let lastImportIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex >= 0) {
      const importLine = "import { apiErrors } from '@/lib/api/standard-response';";
      lines.splice(lastImportIndex + 1, 0, importLine);
      content = lines.join('\n');
    }
  }

  if (content !== original) {
    writeFileSync(filePath, content, "utf-8");
    return { fixed: true, fixes };
  }

  return { fixed: false, fixes: [] };
}

console.log(`\n🔧 Fixing complex error patterns in ${filesToFix.length} files...\n`);

let fixedCount = 0;
for (const file of filesToFix) {
  const fullPath = `./${file}`;
  try {
    const result = fixFile(fullPath);
    if (result.fixed) {
      fixedCount++;
      console.log(`✅ ${file} (${result.fixes.length} fixes)`);
    }
  } catch (error) {
    console.log(`⚠️  ${file} - Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n📊 Fixed ${fixedCount} files\n`);


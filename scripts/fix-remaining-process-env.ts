/**
 * Fix remaining process.env instances in specific files
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const filesToFix = [
  "app/api/stripe/create-checkout-session/route.ts",
  "app/api/stripe/create-customer-checkout/route.ts",
  "app/api/stripe/create-portal-session/route.ts",
  "app/api/stripe/create-table-checkout/route.ts",
  "app/api/stripe/downgrade-plan/route.ts",
  "app/api/staff/invitations/route.ts",
  "app/api/signup/with-subscription/route.ts",
  "app/api/orders/mark-paid/route.ts",
  "app/api/orders/update-status/route.ts",
  "app/api/catalog/reprocess-with-url/route.ts",
  "app/api/auth/test-oauth/route.ts",
  "app/api/auth/health/route.ts",
  "app/api/auth/forgot-password/route.ts",
  "app/api/receipts/send-email/route.ts",
];

function fixFile(filePath: string): boolean {
  const fullPath = join(process.cwd(), filePath);
  let content = readFileSync(fullPath, "utf-8");
  const original = content;
  let changed = false;

  // Replace process.env patterns
  const replacements: Array<[RegExp, string]> = [
    [/process\.env\.STRIPE_BASIC_PRICE_ID/g, "env('STRIPE_BASIC_PRICE_ID')"],
    [/process\.env\.STRIPE_STANDARD_PRICE_ID/g, "env('STRIPE_STANDARD_PRICE_ID')"],
    [/process\.env\.STRIPE_PREMIUM_PRICE_ID/g, "env('STRIPE_PREMIUM_PRICE_ID')"],
    [/process\.env\.NEXT_PUBLIC_BASE_URL/g, "env('NEXT_PUBLIC_BASE_URL')"],
    [/process\.env\.NEXT_PUBLIC_SITE_URL/g, "env('NEXT_PUBLIC_SITE_URL')"],
    [/process\.env\.NEXT_PUBLIC_APP_URL/g, "env('NEXT_PUBLIC_APP_URL')"],
    [/process\.env\.APP_URL/g, "env('APP_URL')"],
    [/process\.env\.NEXT_PUBLIC_SUPABASE_URL/g, "env('NEXT_PUBLIC_SUPABASE_URL')"],
    [/process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/g, "env('NEXT_PUBLIC_SUPABASE_ANON_KEY')"],
    [/process\.env\.SUPABASE_SERVICE_ROLE_KEY/g, "env('SUPABASE_SERVICE_ROLE_KEY')"],
    [/process\.env\.STRIPE_SECRET_KEY/g, "env('STRIPE_SECRET_KEY')"],
    [/process\.env\.STRIPE_WEBHOOK_SECRET/g, "env('STRIPE_WEBHOOK_SECRET')"],
    [/process\.env\.NODE_ENV/g, "getNodeEnv()"],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      changed = true;
    }
  }

  // Add import if needed
  const needsImport = content.includes("env(") || content.includes("getNodeEnv()");
  const hasImport = content.includes("from '@/lib/env'") || content.includes('from "@/lib/env"');

  if (needsImport && !hasImport) {
    const lines = content.split("\n");
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith("import ")) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex >= 0) {
      const importLine =
        "import { env, isDevelopment, isProduction, getNodeEnv } from '@/lib/env';";
      lines.splice(lastImportIndex + 1, 0, importLine);
      content = lines.join("\n");
      changed = true;
    }
  }

  if (content !== original) {
    writeFileSync(fullPath, content, "utf-8");
    return true;
  }

  return false;
}

console.log(`\n🔧 Fixing process.env in ${filesToFix.length} files...\n`);

let fixed = 0;
for (const file of filesToFix) {
  if (fixFile(file)) {
    fixed++;
    console.log(`✅ ${file}`);
  }
}

console.log(`\n📊 Fixed ${fixed} files\n`);

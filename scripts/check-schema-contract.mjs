import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TARGET_DIRS = [path.join(ROOT, "app"), path.join(ROOT, "lib")];
const TYPES_FILE = path.join(ROOT, "types", "database.ts");

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(abs, files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!abs.endsWith(".ts") && !abs.endsWith(".tsx")) continue;
    if (abs.includes("/__tests__/")) continue;
    files.push(abs);
  }
  return files;
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

const SCHEMA_PATTERNS = [
  {
    name: "orders uses legacy status column in filters",
    regex:
      /from\("orders"\)[^;]*\.(?:eq|neq|in|not)\(\s*["'`]status["'`]/m,
  },
  {
    name: "orders update/insert uses legacy status field",
    regex:
      /from\("orders"\)[^;]*\.(?:update|insert)\(\s*\{[^}]*?(?:^|[^A-Za-z_])status\s*:/m,
  },
  {
    name: "orders uses legacy payment_intent_id column in filters",
    regex:
      /from\("orders"\)[^;]*\.(?:eq|neq|in|not)\(\s*["'`]payment_intent_id["'`]/m,
  },
  {
    name: "orders select references legacy payment_intent_id column",
    regex:
      /from\("orders"\)[^;]*\.select\([^)]*(?<!stripe_)payment_intent_id[^)]*\)/m,
  },
  {
    name: "orders update/insert uses legacy payment_intent_id field",
    regex:
      /from\("orders"\)[^;]*\.(?:update|insert)\(\s*\{[^}]*?(?<!stripe_)payment_intent_id\s*:/m,
  },
];

function checkCodePatterns() {
  const files = TARGET_DIRS.flatMap((dir) => walkFiles(dir));
  const violations = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of SCHEMA_PATTERNS) {
      if (pattern.regex.test(source)) {
        violations.push({ file: relative(file), reason: pattern.name });
      }
    }
  }

  return violations;
}

function checkOrderTypeContract() {
  const source = fs.readFileSync(TYPES_FILE, "utf8");
  const orderRowMatch = source.match(/export interface OrderRow \{([\s\S]*?)\n\}/m);

  if (!orderRowMatch?.[1]) {
    return ['types/database.ts is missing "OrderRow" interface'];
  }

  const block = orderRowMatch[1];
  const issues = [];

  if (!/\border_status\s*:/.test(block)) {
    issues.push('types/database.ts OrderRow must define "order_status"');
  }
  if (/\n\s*status\s*:/.test(block)) {
    issues.push('types/database.ts OrderRow must not define legacy bare "status"');
  }
  if (!/\bstripe_payment_intent_id\s*:/.test(block)) {
    issues.push('types/database.ts OrderRow must define "stripe_payment_intent_id"');
  }
  if (/\b(?<!stripe_)payment_intent_id\s*:/.test(block)) {
    issues.push('types/database.ts OrderRow must not define legacy "payment_intent_id"');
  }

  return issues;
}

function main() {
  console.log("🧭 Checking schema contract drift (critical columns only)...");

  const violations = checkCodePatterns();
  const typeIssues = checkOrderTypeContract();

  if (violations.length > 0) {
    console.error("\nCode contract violations:");
    for (const violation of violations) {
      console.error(`  - ${violation.file}: ${violation.reason}`);
    }
  }

  if (typeIssues.length > 0) {
    console.error("\nType contract violations:");
    for (const issue of typeIssues) {
      console.error(`  - ${issue}`);
    }
  }

  if (violations.length > 0 || typeIssues.length > 0) {
    console.error("\n❌ FAILED: Schema contract drift detected.");
    process.exit(1);
  }

  console.log("✅ PASSED: No critical schema contract drift detected.");
}

main();

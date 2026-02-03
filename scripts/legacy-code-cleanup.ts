#!/usr/bin/env tsx
/**
 * Legacy Code Cleanup Script
 * Identifies and reports duplicate/legacy code patterns in lib/
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const LIB_DIR = join(process.cwd(), 'lib');
const REPORT_FILE = join(process.cwd(), 'legacy-code-report.md');

interface DuplicateInfo {
  file: string;
  line: number;
  content: string;
}

interface LegacyPattern {
  pattern: string;
  description: string;
  files: string[];
  recommendation: string;
}

// Patterns to check for legacy/duplicate code
const LEGACY_PATTERNS = [
  {
    pattern: /console\.(log|error|warn|info)/,
    description: 'Console statements that should be replaced with structured logging',
    recommendation: 'Use structuredLogger from lib/structured-logger.ts',
  },
  {
    pattern: /JSON\.parse\(/g,
    description: 'Manual JSON parsing without error handling',
    recommendation: 'Use safeJsonParse utility',
  },
  {
    pattern: /setTimeout.*1000/g,
    description: 'Hardcoded 1-second timeouts',
    recommendation: 'Extract to constant with meaningful name',
  },
  {
    pattern: /catch\s*\(\s*_\s*\)/g,
    description: 'Empty catch blocks that silently ignore errors',
    recommendation: 'Log errors or handle them appropriately',
  },
  {
    pattern: /@ts-ignore/g,
    description: 'TypeScript ignore comments',
    recommendation: 'Fix the type issue instead of ignoring it',
  },
  {
    pattern: /any\s*[:=]/g,
    description: 'Uses of "any" type',
    recommendation: 'Use specific types or unknown with proper guards',
  },
];

// Duplicate detection patterns
const DUPLICATE_PATTERNS = [
  {
    name: 'getCacheKey',
    match: /function\s+(getCacheKey|cacheKey)/,
    description: 'Duplicate cache key generation functions',
    recommendation: 'Use lib/cache/constants.ts cacheKeys',
  },
  {
    name: 'formatCurrency',
    match: /function\s+(formatCurrency|formatPrice)/,
    description: 'Duplicate currency formatting functions',
    recommendation: 'Use lib/money.ts formatCurrency',
  },
  {
    name: 'validateEmail',
    match: /function\s+validateEmail/,
    description: 'Duplicate email validation',
    recommendation: 'Use lib/security.ts validateEmail',
  },
  {
    name: 'dateFormatting',
    match: /function\s+(formatDate|formatTime)/,
    description: 'Duplicate date formatting',
    recommendation: 'Use date-fns or lib/dates.ts',
  },
];

function scanFile(filePath: string): LegacyPattern[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues: LegacyPattern[] = [];

  // Check for legacy patterns
  for (const legacyPattern of LEGACY_PATTERNS) {
    const matches = content.match(legacyPattern.pattern);
    if (matches && matches.length > 0) {
      issues.push({
        pattern: legacyPattern.pattern.source,
        description: legacyPattern.description,
        files: [filePath],
        recommendation: legacyPattern.recommendation,
      });
    }
  }

  return issues;
}

function findDuplicateFunctions(): DuplicateInfo[] {
  const duplicates: DuplicateInfo[] = [];
  const functionsFound: Map<string, string[]> = new Map();

  const files = readdirSync(LIB_DIR, { recursive: true })
    .filter((f) => f.toString().endsWith('.ts') && !f.toString().includes('.d.ts'))
    .map((f) => join(LIB_DIR, f.toString()));

  for (const file of files) {
    if (!existsSync(file)) continue;
    
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (const pattern of DUPLICATE_PATTERNS) {
      const match = content.match(pattern.match);
      if (match) {
        const funcName = match[1];
        if (!functionsFound.has(funcName)) {
          functionsFound.set(funcName, []);
        }
        functionsFound.get(funcName)!.push(file);
      }
    }
  }

  // Find duplicates (functions appearing in multiple files)
  for (const [func, files] of functionsFound) {
    if (files.length > 1) {
      duplicates.push({
        file: files[0],
        line: 1,
        content: `Function "${func}" duplicated in ${files.length} files`,
      });
    }
  }

  return duplicates;
}

function generateReport(): void {
  console.log('🔍 Scanning lib/ directory for legacy code patterns...\n');

  const allIssues: LegacyPattern[] = [];
  const duplicates = findDuplicateFunctions();

  const files = readdirSync(LIB_DIR, { recursive: true })
    .filter((f) => f.toString().endsWith('.ts') && !f.toString().includes('.d.ts'))
    .map((f) => join(LIB_DIR, f.toString()));

  for (const file of files) {
    if (!existsSync(file)) continue;
    const issues = scanFile(file);
    allIssues.push(...issues);
  }

  // Generate markdown report
  let report = '# Legacy Code Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  report += '## Summary\n\n';
  report += `- **Legacy Patterns Found**: ${allIssues.length}\n`;
  report += `- **Duplicate Functions**: ${duplicates.length}\n\n`;

  report += '## Duplicate Functions\n\n';
  report += '| Function | Files | Recommendation |\n';
  report += '|----------|-------|----------------|\n';

  const uniqueDuplicates = new Map();
  for (const dup of duplicates) {
    const funcMatch = dup.content.match(/"(.+)" duplicated/);
    if (funcMatch && !uniqueDuplicates.has(funcMatch[1])) {
      uniqueDuplicates.set(funcMatch[1], dup);
    }
  }

  for (const [func, dup] of uniqueDuplicates) {
    const files = dup.file.split('/').slice(-3).join('/');
    report += `| ${func} | ${files} | Consolidate to single utility |\n`;
  }

  report += '\n## Legacy Patterns\n\n';
  report += '| Pattern | Description | Recommendation |\n';
  report += '|---------|-------------|---------------|\n';

  const uniquePatterns = new Map();
  for (const issue of allIssues) {
    if (!uniquePatterns.has(issue.description)) {
      uniquePatterns.set(issue.description, issue);
    }
  }

  for (const issue of uniquePatterns.values()) {
    report += `| ${issue.pattern.substring(0, 30)}... | ${issue.description} | ${issue.recommendation} |\n`;
  }

  report += '\n## Priority Actions\n\n';
  report += '1. **High Priority**: Replace all console statements with structured logging\n';
  report += '2. **High Priority**: Add error handling to empty catch blocks\n';
  report += '3. **Medium Priority**: Replace "any" types with specific types\n';
  report += '4. **Medium Priority**: Remove @ts-ignore comments\n';
  report += '5. **Low Priority**: Consolidate duplicate utility functions\n';

  writeFileSync(REPORT_FILE, report);
  console.log(`✅ Report generated: ${REPORT_FILE}\n`);
  console.log(`Found ${allIssues.length} legacy patterns and ${duplicates.length} duplicate functions.`);
}

// Run if called directly
if (require.main === module) {
  generateReport();
}

export { scanFile, findDuplicateFunctions, generateReport };

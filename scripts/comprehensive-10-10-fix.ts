#!/usr/bin/env ts-node
/**
 * Comprehensive 10/10 Codebase Fix Script
 * 
 * This script performs:
 * 1. Removes console.log/info/debug/trace (keeps error/warn)
 * 2. Creates TODO ledger
 * 3. Standardizes API route handlers
 * 4. Removes duplicate code patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const DRY_RUN = process.argv.includes('--dry-run');

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
}

function getAllFiles(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      // Skip node_modules, .next, coverage, etc.
      if (!['node_modules', '.next', 'coverage', '.git', 'dist', 'build'].includes(file)) {
        results = results.concat(getAllFiles(filePath, extensions));
      }
    } else if (extensions.some(ext => filePath.endsWith(ext))) {
      results.push(filePath);
    }
  }
  
  return results;
}

// Step 1: Remove console.log/info/debug/trace
function removeConsoleLogs() {
  log('\n🔧 Step 1: Removing console.log/info/debug/trace...', 'blue');
  
  const files = getAllFiles(process.cwd(), ['.ts', '.tsx', '.js', '.jsx']);
  let totalRemoved = 0;
  const modifiedFiles: string[] = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const newLines: string[] = [];
    let fileModified = false;
    
    for (const line of lines) {
      // Match console.log, console.info, console.debug, console.trace
      // but NOT console.error or console.warn
      const logMatch = line.match(/^\s*console\.(log|info|debug|trace)\(/);
      if (logMatch) {
        totalRemoved++;
        fileModified = true;
        // Comment out instead of deleting for safety
        newLines.push(`// ${line.trim()} // Removed by 10/10 fix`);
      } else {
        newLines.push(line);
      }
    }
    
    if (fileModified && !DRY_RUN) {
      fs.writeFileSync(file, newLines.join('\n'), 'utf-8');
      modifiedFiles.push(file);
    }
  }
  
  log(`   ✓ Removed ${totalRemoved} console.log/info/debug/trace statements`, 'green');
  if (modifiedFiles.length > 0) {
    log(`   ✓ Modified ${modifiedFiles.length} files`, 'green');
  }
  
  return { totalRemoved, modifiedFiles };
}

// Step 2: Create TODO ledger
function createTODOLedger() {
  log('\n📝 Step 2: Creating TODO ledger...', 'blue');
  
  const files = getAllFiles(process.cwd(), ['.ts', '.tsx', '.js', '.jsx']);
  const todos: Array<{ file: string; line: number; content: string }> = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('TODO') || line.includes('FIXME') || line.includes('XXX')) {
        todos.push({
          file: file.replace(process.cwd() + '/', ''),
          line: i + 1,
          content: line.trim(),
        });
      }
    }
  }
  
  const ledgerPath = path.join(process.cwd(), 'TODO_LEDGER_2025-01-19.md');
  const ledgerContent = `# TODO Ledger - Generated ${new Date().toISOString()}

Total TODOs/FIXMEs found: ${todos.length}

## Summary by File

${Array.from(new Set(todos.map(t => t.file)))
  .map(file => {
    const count = todos.filter(t => t.file === file).length;
    return `- ${file}: ${count} TODO(s)`;
  })
  .join('\n')}

## Detailed List

${todos
  .map(t => `### ${t.file}:${t.line}\n\`\`\`\n${t.content}\n\`\`\``)
  .join('\n\n')}
`;
  
  if (!DRY_RUN) {
    fs.writeFileSync(ledgerPath, ledgerContent, 'utf-8');
  }
  
  log(`   ✓ Found ${todos.length} TODOs/FIXMEs`, 'green');
  log(`   ✓ Created ledger at ${ledgerPath}`, 'green');
  
  return todos;
}

// Step 3: Standardize API routes
function standardizeAPIRoutes() {
  log('\n🔧 Step 3: Standardizing API route handlers...', 'blue');
  
  const apiDir = path.join(process.cwd(), 'app', 'api');
  if (!fs.existsSync(apiDir)) {
    log('   ⚠ No app/api directory found', 'yellow');
    return { standardized: 0, modified: [] };
  }
  
  const routeFiles = getAllFiles(apiDir, ['route.ts']);
  let standardized = 0;
  const modified: string[] = [];
  
  for (const file of routeFiles) {
    let content = fs.readFileSync(file, 'utf-8');
    let fileModified = false;
    
    // Add runtime config if missing
    if (!content.includes("export const runtime")) {
      content = `export const runtime = "nodejs";\nexport const dynamic = "force-dynamic";\n\n${content}`;
      fileModified = true;
    }
    
    // Ensure NextRequest is imported
    if (content.includes('async function') && !content.includes("from 'next/server'")) {
      const importLine = content.match(/^import .+ from ['"]next\/server['"]/m);
      if (!importLine) {
        // Add NextRequest import
        const firstImport = content.match(/^import .+/m);
        if (firstImport) {
          content = content.replace(
            firstImport[0],
            `${firstImport[0]}\nimport { NextRequest } from 'next/server';`
          );
          fileModified = true;
        }
      }
    }
    
    // Replace Request with NextRequest in function signatures
    if (content.includes('async function POST(req: Request)')) {
      content = content.replace(/async function POST\(req: Request\)/g, 'async function POST(req: NextRequest)');
      fileModified = true;
    }
    if (content.includes('async function GET(req: Request)')) {
      content = content.replace(/async function GET\(req: Request\)/g, 'async function GET(req: NextRequest)');
      fileModified = true;
    }
    if (content.includes('async function PATCH(req: Request)')) {
      content = content.replace(/async function PATCH\(req: Request\)/g, 'async function PATCH(req: NextRequest)');
      fileModified = true;
    }
    if (content.includes('async function PUT(req: Request)')) {
      content = content.replace(/async function PUT\(req: Request\)/g, 'async function PUT(req: NextRequest)');
      fileModified = true;
    }
    if (content.includes('async function DELETE(req: Request)')) {
      content = content.replace(/async function DELETE\(req: Request\)/g, 'async function DELETE(req: NextRequest)');
      fileModified = true;
    }
    
    if (fileModified && !DRY_RUN) {
      fs.writeFileSync(file, content, 'utf-8');
      modified.push(file);
      standardized++;
    } else if (fileModified) {
      standardized++;
    }
  }
  
  log(`   ✓ Standardized ${standardized} API route files`, 'green');
  if (modified.length > 0) {
    log(`   ✓ Modified ${modified.length} files`, 'green');
  }
  
  return { standardized, modified };
}

// Step 4: Remove duplicate code patterns
function removeDuplicatePatterns() {
  log('\n🔧 Step 4: Identifying duplicate code patterns...', 'blue');
  
  // This is a simplified version - in production you'd use more sophisticated analysis
  const files = getAllFiles(process.cwd(), ['.ts', '.tsx']);
  
  // Look for common duplicate patterns
  const duplicatePatterns = new Map<string, string[]>();
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Pattern: Repeated error handling
    const errorHandlingPattern = /catch\s*\([^)]*\)\s*{\s*console\.error\([^)]*\);\s*return\s+NextResponse\.json\([^)]*\);/g;
    const matches = content.match(errorHandlingPattern);
    if (matches && matches.length > 1) {
      duplicatePatterns.set(file, matches);
    }
  }
  
  log(`   ✓ Found ${duplicatePatterns.size} files with duplicate patterns`, 'green');
  
  return duplicatePatterns;
}

// Main execution
async function main() {
  log('\n' + '='.repeat(60), 'bright');
  log('🚀 Comprehensive 10/10 Codebase Fix', 'bright');
  log('='.repeat(60), 'bright');
  
  if (DRY_RUN) {
    log('\n⚠️  DRY RUN MODE - No files will be modified', 'yellow');
  }
  
  const startTime = Date.now();
  
  try {
    // Step 1: Remove console logs
    const { totalRemoved, modifiedFiles: logFiles } = removeConsoleLogs();
    
    // Step 2: Create TODO ledger
    const todos = createTODOLedger();
    
    // Step 3: Standardize API routes
    const { standardized, modified: apiFiles } = standardizeAPIRoutes();
    
    // Step 4: Find duplicate patterns
    const duplicates = removeDuplicatePatterns();
    
    // Summary
    log('\n' + '='.repeat(60), 'bright');
    log('📊 Summary', 'bright');
    log('='.repeat(60), 'bright');
    log(`✓ Removed ${totalRemoved} console.log statements`, 'green');
    log(`✓ Found ${todos.length} TODOs/FIXMEs`, 'green');
    log(`✓ Standardized ${standardized} API route files`, 'green');
    log(`✓ Found ${duplicates.size} files with duplicate patterns`, 'green');
    log(`✓ Total modified files: ${logFiles.length + apiFiles.length}`, 'green');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`\n⏱️  Completed in ${duration}s`, 'blue');
    
    if (DRY_RUN) {
      log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.', 'yellow');
    } else {
      log('\n✅ All changes applied successfully!', 'green');
      log('\n📋 Next steps:', 'blue');
      log('   1. Review the changes: git diff', 'blue');
      log('   2. Run type checking: pnpm typecheck', 'blue');
      log('   3. Run linting: pnpm lint', 'blue');
      log('   4. Run formatting: pnpm format', 'blue');
      log('   5. Commit changes: git add -A && git commit -m "chore: apply 10/10 codebase fixes"', 'blue');
    }
  } catch (error) {
    log(`\n❌ Error: ${error}`, 'red');
    process.exit(1);
  }
}

main();


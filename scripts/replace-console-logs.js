#!/usr/bin/env node

/**
 * Automated Console.log Replacement Script
 * Replaces 759+ console.log statements with proper logger
 * 
 * Usage: node scripts/replace-console-logs.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const loggerImport = "import { logger } from '@/lib/logger';";
const loggerImportAuth = "import { authLogger } from '@/lib/logger';";
const loggerImportAPI = "import { apiLogger } from '@/lib/logger';";
const loggerImportDB = "import { dbLogger } from '@/lib/logger';";
const loggerImportAI = "import { aiLogger } from '@/lib/logger';";

const replacements = [
  // API routes
  {
    pattern: /console\.log\(/g,
    replacement: 'logger.debug(',
    context: 'general',
  },
  // Auth-related logs
  {
    pattern: /console\.log\(/g,
    replacement: 'authLogger.debug(',
    context: 'auth',
    files: ['auth', 'sign-in', 'sign-up', 'callback'],
  },
  // API-related logs
  {
    pattern: /console\.log\(/g,
    replacement: 'apiLogger.debug(',
    context: 'api',
    files: ['api'],
  },
  // Database-related logs
  {
    pattern: /console\.log\(/g,
    replacement: 'dbLogger.debug(',
    context: 'db',
    files: ['supabase', 'db'],
  },
  // AI-related logs
  {
    pattern: /console\.log\(/g,
    replacement: 'aiLogger.debug(',
    context: 'ai',
    files: ['ai-assistant', 'ai/', 'tool-executors'],
  },
];

function shouldSkipFile(filePath) {
  const skipPatterns = [
    'node_modules',
    '.next',
    'coverage',
    'scripts/replace-console-logs.js',
    'lib/logger',
    'vitest.config.ts',
    'playwright.config',
    'next.config',
    '.test.',
    '.spec.',
  ];

  return skipPatterns.some(pattern => filePath.includes(pattern));
}

function getLoggerForFile(filePath) {
  if (filePath.includes('auth') || filePath.includes('sign-in') || filePath.includes('sign-up') || filePath.includes('callback')) {
    return 'authLogger';
  }
  if (filePath.includes('api')) {
    return 'apiLogger';
  }
  if (filePath.includes('supabase') || filePath.includes('db')) {
    return 'dbLogger';
  }
  if (filePath.includes('ai-assistant') || filePath.includes('ai/') || filePath.includes('tool-executors')) {
    return 'aiLogger';
  }
  return 'logger';
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if no console.log
    if (!content.includes('console.log')) {
      return { processed: false, reason: 'no console.log' };
    }

    // Determine which logger to use
    const loggerName = getLoggerForFile(filePath);
    
    // Check if logger is already imported
    const hasLoggerImport = content.includes('from \'@/lib/logger\'') || 
                           content.includes('from "@/lib/logger"') ||
                           content.includes('from \'@lib/logger\'') ||
                           content.includes('from "@lib/logger"');

    // Replace console.log with appropriate logger
    let newContent = content.replace(/console\.log\(/g, `${loggerName}.debug(`);

    // Add import if needed
    if (!hasLoggerImport) {
      // Find the last import statement
      const importRegex = /^import .* from ['"].*['"];?$/gm;
      const imports = content.match(importRegex);
      
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertPosition = lastImportIndex + lastImport.length;
        
        newContent = 
          content.slice(0, insertPosition) + 
          '\n' + `import { ${loggerName} } from '@/lib/logger';` + 
          content.slice(insertPosition);
      } else {
        // No imports, add at the top
        newContent = `import { ${loggerName} } from '@/lib/logger';\n${newContent}`;
      }
    }

    // Write back
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    return { processed: true, logger: loggerName };
  } catch (error) {
    return { processed: false, reason: error.message };
  }
}

function findTypeScriptFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findTypeScriptFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function main() {
  console.log('🚀 Starting console.log replacement...\n');

  const directories = [
    'app',
    'components',
    'lib',
    'hooks',
  ];

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  const results = {
    logger: 0,
    authLogger: 0,
    apiLogger: 0,
    dbLogger: 0,
    aiLogger: 0,
  };

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`⚠️  Directory ${dir} not found, skipping...`);
      return;
    }

    console.log(`📁 Processing ${dir}...`);
    
    const files = findTypeScriptFiles(dir);
    let dirProcessed = 0;
    let dirSkipped = 0;

    files.forEach(file => {
      if (shouldSkipFile(file)) {
        dirSkipped++;
        totalSkipped++;
        return;
      }

      const result = processFile(file);
      
      if (result.processed) {
        dirProcessed++;
        totalProcessed++;
        results[result.logger]++;
        console.log(`  ✅ ${path.relative(process.cwd(), file)} -> ${result.logger}`);
      } else if (result.reason !== 'no console.log') {
        totalErrors++;
        console.log(`  ❌ ${path.relative(process.cwd(), file)}: ${result.reason}`);
      } else {
        dirSkipped++;
        totalSkipped++;
      }
    });

    console.log(`  📊 ${dir}: ${dirProcessed} processed, ${dirSkipped} skipped\n`);
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 REPLACEMENT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Total files processed: ${totalProcessed}`);
  console.log(`⏭️  Total files skipped: ${totalSkipped}`);
  console.log(`❌ Total errors: ${totalErrors}`);
  console.log('\n📈 Logger usage:');
  console.log(`  - logger: ${results.logger}`);
  console.log(`  - authLogger: ${results.authLogger}`);
  console.log(`  - apiLogger: ${results.apiLogger}`);
  console.log(`  - dbLogger: ${results.dbLogger}`);
  console.log(`  - aiLogger: ${results.aiLogger}`);
  console.log('\n✅ Console.log replacement complete!');
  console.log('💡 Next steps:');
  console.log('   1. Review the changes');
  console.log('   2. Run: pnpm run lint');
  console.log('   3. Run: pnpm run typecheck');
  console.log('   4. Test the application');
}

main();


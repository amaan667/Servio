/**
 * Comprehensive Console.log Replacement Script
 * Replaces console.log statements with structured logger
 */

const fs = require('fs');
const path = require('path');

// Directories to process
const DIRECTORIES = [
  'app',
  'components',
  'lib',
  'hooks',
];

// Files/directories to skip
const SKIP_PATTERNS = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '__tests__',
  'scripts',
  'coverage',
  'logger',
  '.git',
];

// Replacement patterns
const REPLACEMENTS = [
  {
    // Console.error -> logger.error
    pattern: /console\.error\(/g,
    replacement: 'logger.error(',
    comment: '// Replaced console.error with logger.error',
  },
  {
    // Console.warn -> logger.warn
    pattern: /console\.warn\(/g,
    replacement: 'logger.warn(',
    comment: '// Replaced console.warn with logger.warn',
  },
  {
    // Console.info -> logger.info
    pattern: /console\.info\(/g,
    replacement: 'logger.info(',
    comment: '// Replaced console.info with logger.info',
  },
  {
    // Console.log with [DEBUG] -> logger.debug
    pattern: /console\.log\(/g,
    replacement: 'logger.debug(',
    comment: '// Replaced console.log with logger.debug',
  },
];

// Track statistics
const stats = {
  filesProcessed: 0,
  replacements: 0,
  errors: 0,
};

/**
 * Check if file should be skipped
 */
function shouldSkip(filePath) {
  return SKIP_PATTERNS.some(pattern => filePath.includes(pattern));
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let replacements = 0;

    // Check if file already imports logger
    const hasLoggerImport = content.includes("from '@/lib/logger'") || 
                           content.includes('from "@/lib/logger"') ||
                           content.includes('require("@/lib/logger")');

    // Apply replacements
    for (const { pattern, replacement, comment } of REPLACEMENTS) {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        replacements++;
        modified = true;
      }
    }

    // Add logger import if needed and file was modified
    if (modified && !hasLoggerImport) {
      // Find the last import statement
      const importRegex = /^import .+ from ['"].+['"];?$/gm;
      const imports = content.match(importRegex);
      
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.indexOf(lastImport) + lastImport.length;
        
        // Add logger import after last import
        const loggerImport = '\nimport { logger } from \'@/lib/logger\';';
        content = content.slice(0, lastImportIndex) + loggerImport + content.slice(lastImportIndex);
      } else {
        // No imports found, add at the top
        const lines = content.split('\n');
        const firstNonCommentLine = lines.findIndex(line => 
          line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('/*')
        );
        lines.splice(firstNonCommentLine, 0, "import { logger } from '@/lib/logger';");
        content = lines.join('\n');
      }
    }

    // Write back if modified
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      stats.filesProcessed++;
      stats.replacements += replacements;
      console.log(`✅ Processed: ${filePath} (${replacements} replacements)`);
    }

  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    stats.errors++;
  }
}

/**
 * Recursively process directory
 */
function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (shouldSkip(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      processFile(fullPath);
    }
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Starting comprehensive console.log replacement...\n');

  const projectRoot = path.resolve(__dirname, '..');

  for (const dir of DIRECTORIES) {
    const dirPath = path.join(projectRoot, dir);
    if (fs.existsSync(dirPath)) {
      console.log(`📁 Processing directory: ${dir}`);
      processDirectory(dirPath);
    }
  }

  console.log('\n📊 Statistics:');
  console.log(`   Files processed: ${stats.filesProcessed}`);
  console.log(`   Total replacements: ${stats.replacements}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log('\n✅ Console.log replacement complete!');
}

main();


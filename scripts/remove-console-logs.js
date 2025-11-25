/**
 * Script to remove/replace console.log statements with logger
 * Run: node scripts/remove-console-logs.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const loggerMap = {
  'console.log': 'logger.debug',
  'console.error': 'logger.error',
  'console.warn': 'logger.warn',
  'console.info': 'logger.info',
  'console.debug': 'logger.debug',
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let hasLoggerImport = content.includes('from "@/lib/logger"') || content.includes('from \'@/lib/logger\'');

  // Replace console statements
  for (const [consoleMethod, loggerMethod] of Object.entries(loggerMap)) {
    const regex = new RegExp(consoleMethod.replace('.', '\\.'), 'g');
    if (content.match(regex)) {
      content = content.replace(regex, loggerMethod);
      modified = true;
    }
  }

  // Add logger import if needed and not present
  if (modified && !hasLoggerImport) {
    // Try to find import statements
    const importMatch = content.match(/^import .* from ['"]@\/lib\/.*['"];?$/m);
    if (importMatch) {
      const importIndex = content.indexOf(importMatch[0]) + importMatch[0].length;
      content = content.slice(0, importIndex) + '\nimport { logger } from "@/lib/logger";' + content.slice(importIndex);
    } else {
      // Add at the top
      content = 'import { logger } from "@/lib/logger";\n' + content;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Processed: ${filePath}`);
    return true;
  }
  return false;
}

function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.next')) {
      findFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Process all files
const appDir = path.join(__dirname, '..', 'app');
const files = findFiles(appDir);

let processedCount = 0;
files.forEach(file => {
  if (processFile(file)) {
    processedCount++;
  }
});

console.log(`\n✓ Processed ${processedCount} files`);


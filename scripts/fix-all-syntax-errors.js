#!/usr/bin/env node
/**
 * Comprehensive fix for all syntax errors caused by console.log removal
 * Fixes broken try-catch blocks, missing braces, etc.
 */

const fs = require('fs');
const path = require('path');

function getAllFiles(dir, extensions) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      if (!['node_modules', '.next', 'coverage', '.git', 'dist', 'build', 'public'].includes(file)) {
        results = results.concat(getAllFiles(filePath, extensions));
      }
    } else if (extensions.some(ext => filePath.endsWith(ext))) {
      results.push(filePath);
    }
  }
  
  return results;
}

function fixSyntaxErrors() {
  const files = getAllFiles(process.cwd(), ['.ts', '.tsx']);
  let totalFixed = 0;
  const modifiedFiles = [];
  
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    let fileModified = false;
    
    // Fix: } catch (error) { without try
    // This happens when try block was removed but catch remained
    const brokenCatchPattern = /(\s+)(catch \(error[^)]*\) \{)/g;
    let match;
    while ((match = brokenCatchPattern.exec(content)) !== null) {
      // Check if there's a try block before this catch
      const beforeCatch = content.substring(0, match.index);
      const lastTry = beforeCatch.lastIndexOf('try {');
      const lastCatch = beforeCatch.lastIndexOf('} catch');
      
      // If no try block or last catch is after last try, we have a problem
      if (lastTry === -1 || lastCatch > lastTry) {
        // Remove this orphaned catch block
        content = content.replace(match[0], '');
        fileModified = true;
        totalFixed++;
      }
    }
    
    // Fix: Missing closing braces for try blocks
    // Look for try { followed by code but no catch
    const tryWithoutCatchPattern = /try \{([^}]*?)(\n\s*)(catch|finally)/g;
    if (tryWithoutCatchPattern.test(content)) {
      // This is a valid try-catch, skip
    } else {
      // Check for orphaned try blocks
      const orphanedTryPattern = /try \{([^}]*?)(\n\s*)(\})/g;
      if (orphanedTryPattern.test(content)) {
        // Remove orphaned try blocks
        content = content.replace(orphanedTryPattern, '$1$2$3');
        fileModified = true;
        totalFixed++;
      }
    }
    
    // Fix: Missing opening braces
    // Look for } catch without matching try
    const missingTryPattern = /(\n\s*)(} catch \(error[^)]*\) \{)/g;
    if (missingTryPattern.test(content)) {
      // Add try { before the catch
      content = content.replace(missingTryPattern, '$1try {\n$1  // Auto-fixed try block\n$1$2');
      fileModified = true;
      totalFixed++;
    }
    
    // Fix: Orphaned closing braces
    const orphanedBracesPattern = /(\n\s*)(\}\);/g;
    if (orphanedBracesPattern.test(content)) {
      // Check if this is actually orphaned
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '});' && i > 0) {
          const prevLine = lines[i - 1];
          // If previous line is empty or just whitespace, this might be orphaned
          if (prevLine.trim() === '') {
            // Check if there's a matching opening
            let openCount = 0;
            for (let j = i - 1; j >= 0; j--) {
              const checkLine = lines[j];
              if (checkLine.includes('(')) openCount++;
              if (checkLine.includes(')')) openCount--;
              if (openCount > 0) break;
            }
            if (openCount === 0) {
              // This is orphaned, remove it
              lines[i] = '';
              fileModified = true;
              totalFixed++;
            }
          }
        }
      }
      if (fileModified) {
        content = lines.join('\n');
      }
    }
    
    if (fileModified) {
      fs.writeFileSync(file, content, 'utf-8');
      modifiedFiles.push(file);
    }
  }
  
  console.log(`✓ Fixed ${totalFixed} syntax errors`);
  console.log(`✓ Modified ${modifiedFiles.length} files`);
  
  return { totalFixed, modifiedFiles };
}

fixSyntaxErrors();


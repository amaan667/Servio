#!/usr/bin/env node
/**
 * Fix broken console.log statements that were commented out incorrectly
 * Removes commented console.log lines and their associated object literals
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

function fixBrokenConsoleLogs() {
  const files = getAllFiles(process.cwd(), ['.ts', '.tsx', '.js', '.jsx']);
  let totalFixed = 0;
  const modifiedFiles = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const newLines = [];
    let fileModified = false;
    let skipNextLines = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip lines if we're in the middle of removing a console.log statement
      if (skipNextLines > 0) {
        skipNextLines--;
        fileModified = true;
        continue;
      }
      
      // Match commented console.log/info/debug/trace
      const logMatch = line.match(/^\/\/ console\.(log|info|debug|trace)\(/);
      if (logMatch) {
        // Remove this line and check if the next lines are object literals
        fileModified = true;
        totalFixed++;
        
        // Check how many lines to skip (look for closing }); or }); pattern)
        let j = i + 1;
        let openBraces = 0;
        let foundClose = false;
        
        while (j < lines.length && j < i + 10) { // Max 10 lines to check
          const nextLine = lines[j];
          if (nextLine.trim().startsWith('//')) {
            j++;
            continue;
          }
          
          // Count braces
          for (const char of nextLine) {
            if (char === '{') openBraces++;
            if (char === '}') openBraces--;
          }
          
          // Check if this line has the closing pattern
          if (nextLine.includes('});') || nextLine.includes('});')) {
            foundClose = true;
            break;
          }
          
          j++;
        }
        
        if (foundClose) {
          skipNextLines = j - i;
        }
        
        continue;
      }
      
      newLines.push(line);
    }
    
    if (fileModified) {
      fs.writeFileSync(file, newLines.join('\n'), 'utf-8');
      modifiedFiles.push(file);
    }
  }
  
  console.log(`✓ Fixed ${totalFixed} broken console.log statements`);
  console.log(`✓ Modified ${modifiedFiles.length} files`);
  
  return { totalFixed, modifiedFiles };
}

fixBrokenConsoleLogs();


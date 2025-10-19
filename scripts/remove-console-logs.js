#!/usr/bin/env node
/**
 * Remove console.log/info/debug/trace statements
 * Keeps console.error and console.warn
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

function removeConsoleLogs() {
  const files = getAllFiles(process.cwd(), ['.ts', '.tsx', '.js', '.jsx']);
  let totalRemoved = 0;
  const modifiedFiles = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const newLines = [];
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
    
    if (fileModified) {
      fs.writeFileSync(file, newLines.join('\n'), 'utf-8');
      modifiedFiles.push(file);
    }
  }
  
  
  return { totalRemoved, modifiedFiles };
}

removeConsoleLogs();


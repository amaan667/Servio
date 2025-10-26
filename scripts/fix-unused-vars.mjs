#!/usr/bin/env node

/**
 * Fix unused variables by prefixing with _
 * 
 * Examples:
 * - error => _error
 * - req => _req
 * - data => _data
 */

import fs from 'fs';
import { execSync } from 'child_process';

// Get all unused variable errors from ESLint
const lintOutput = execSync('npm run lint 2>&1', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

// Parse lint output for unused vars
const unusedVarPattern = /(.+):(\d+):(\d+)\s+error\s+'([^']+)' is (defined but never used|assigned a value but never used|never reassigned)/g;

const fixes = new Map();
let match;

while ((match = unusedVarPattern.exec(lintOutput)) !== null) {
  const [, filePath, lineNum, , varName, reason] = match;
  
  if (!fixes.has(filePath)) {
    fixes.set(filePath, []);
  }
  
  fixes.get(filePath).push({
    line: parseInt(lineNum),
    varName,
    reason
  });
}

console.log(`📊 Found ${Array.from(fixes.values()).reduce((sum, arr) => sum + arr.length, 0)} unused variables in ${fixes.size} files\n`);

let totalFixed = 0;

for (const [filePath, variables] of fixes) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let lines = content.split('\n');
    
    // Sort by line number (descending) to avoid offset issues
    variables.sort((a, b) => b.line - a.line);
    
    for (const { line, varName } of variables) {
      const lineIndex = line - 1;
      if (lineIndex < 0 || lineIndex >= lines.length) continue;
      
      const currentLine = lines[lineIndex];
      
      // Skip if already prefixed
      if (currentLine.includes(`_${varName}`)) continue;
      
      // Replace variable name with _varName
      // Handle different declaration patterns
      const patterns = [
        // const { error } = ...
        new RegExp(`(const|let)\\s*{([^}]*\\b)${varName}(\\b[^}]*)}`),
        // const error = ...
        new RegExp(`(const|let)\\s+${varName}\\b`),
        // function foo(error)
        new RegExp(`\\(([^)]*\\b)${varName}(\\b[^)]*)`),
        // catch (error)
        new RegExp(`catch\\s*\\(\\s*${varName}\\s*\\)`),
      ];
      
      let replaced = false;
      for (const pattern of patterns) {
        if (currentLine.match(pattern)) {
          lines[lineIndex] = currentLine.replace(pattern, (match) => {
            return match.replace(new RegExp(`\\b${varName}\\b`), `_${varName}`);
          });
          replaced = true;
          totalFixed++;
          break;
        }
      }
    }
    
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`✅ ${filePath}: Fixed ${variables.length} unused vars`);
    
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
}

console.log(`\n✅ Fixed ${totalFixed} unused variables`);
console.log(`🔍 Run 'npm run lint' to verify`);


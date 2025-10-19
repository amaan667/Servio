#!/usr/bin/env node
/**
 * Analyze and categorize all 'any' types in the codebase
 */

const fs = require('fs');
const path = require('path');

const results = [];

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Match various patterns of 'any' usage
    if (/: any\b/.test(line) || 
        /<any>/.test(line) || 
        /Array<any>/.test(line) || 
        /Promise<any>/.test(line) ||
        /Record<string,\s*any>/.test(line) ||
        /\bany\[\]/.test(line)) {
      
      let category = 'unknown';
      
      // Categorize based on context
      if (line.includes('req:') || line.includes('request:')) category = 'request-param';
      else if (line.includes('res:') || line.includes('response:')) category = 'response-param';
      else if (line.includes('error:') || line.includes('err:')) category = 'error-handling';
      else if (line.includes('data:') || line.includes('result:')) category = 'data-type';
      else if (line.includes('body:') || line.includes('payload:')) category = 'request-body';
      else if (line.includes('params:')) category = 'route-params';
      else if (line.includes('query:')) category = 'query-params';
      else if (line.includes('callback:') || line.includes('fn:')) category = 'callback';
      else if (line.includes('Array<any>')) category = 'array-type';
      else if (line.includes('Promise<any>')) category = 'promise-type';
      else if (line.includes('Record<string, any>')) category = 'record-type';
      
      results.push({
        file: filePath,
        line: index + 1,
        context: line.trim(),
        category: category,
      });
    }
  });
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .next
      if (file !== 'node_modules' && file !== '.next' && file !== 'dist' && file !== 'build' && file !== 'coverage') {
        walkDirectory(filePath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      analyzeFile(filePath);
    }
  });
}

// Main execution

const baseDir = path.join(__dirname, '..');
walkDirectory(path.join(baseDir, 'app'));
walkDirectory(path.join(baseDir, 'lib'));
walkDirectory(path.join(baseDir, 'components'));
walkDirectory(path.join(baseDir, 'hooks'));

// Group by category
const byCategory = {};
results.forEach(item => {
  if (!byCategory[item.category]) {
    byCategory[item.category] = [];
  }
  byCategory[item.category].push(item);
});

// Group by file
const byFile = {};
results.forEach(item => {
  if (!byFile[item.file]) {
    byFile[item.file] = [];
  }
  byFile[item.file].push(item);
});

// Print summary


// Write detailed report
const reportPath = path.join(__dirname, '..', 'ANY_TYPES_REPORT.md');
const report = `# Any Types Analysis Report

Generated: ${new Date().toISOString()}

## Summary
- **Total any types:** ${results.length}
- **Files affected:** ${Object.keys(byFile).length}

## By Category

${Object.entries(byCategory)
  .sort((a, b) => b[1].length - a[1].length)
  .map(([category, items]) => `### ${category} (${items.length})
${items.slice(0, 5).map(item => `- \`${item.file}:${item.line}\` - ${item.context.substring(0, 100)}`).join('\n')}
${items.length > 5 ? `... and ${items.length - 5} more` : ''}
`).join('\n')}

## By File

${Object.entries(byFile)
  .sort((a, b) => b[1].length - a[1].length)
  .map(([file, items]) => `### ${file} (${items.length})
${items.map(item => `- Line ${item.line}: ${item.context.substring(0, 100)}`).join('\n')}
`).join('\n')}
`;

fs.writeFileSync(reportPath, report);


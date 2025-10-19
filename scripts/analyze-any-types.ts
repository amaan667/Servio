#!/usr/bin/env ts-node
/**
 * Analyze and categorize all 'any' types in the codebase
 * Run: npx ts-node scripts/analyze-any-types.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface AnyTypeLocation {
  file: string;
  line: number;
  context: string;
  category: string;
}

const results: AnyTypeLocation[] = [];

function analyzeFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Match various patterns of 'any' usage
    const patterns = [
      /:\s*any\b/g,           // : any
      /<any>/g,               // <any>
      /Array<any>/g,          // Array<any>
      /Promise<any>/g,        // Promise<any>
      /Record<string,\s*any>/g, // Record<string, any>
      /\bany\[\]/g,           // any[]
    ];
    
    patterns.forEach(pattern => {
      if (pattern.test(line)) {
        const match = line.match(pattern);
        if (match) {
          results.push({
            file: filePath,
            line: index + 1,
            context: line.trim(),
            category: categorizeUsage(line, match[0]),
          });
        }
      }
    });
  });
}

function categorizeUsage(line: string, match: string): string {
  // Categorize based on context
  if (line.includes('req:') || line.includes('request:')) return 'request-param';
  if (line.includes('res:') || line.includes('response:')) return 'response-param';
  if (line.includes('error:') || line.includes('err:')) return 'error-handling';
  if (line.includes('data:') || line.includes('result:')) return 'data-type';
  if (line.includes('body:') || line.includes('payload:')) return 'request-body';
  if (line.includes('params:')) return 'route-params';
  if (line.includes('query:')) return 'query-params';
  if (line.includes('callback:') || line.includes('fn:')) return 'callback';
  if (line.includes('Array<any>')) return 'array-type';
  if (line.includes('Promise<any>')) return 'promise-type';
  if (line.includes('Record<string, any>')) return 'record-type';
  return 'unknown';
}

function walkDirectory(dir: string): void {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .next
      if (file !== 'node_modules' && file !== '.next' && file !== 'dist' && file !== 'build') {
        walkDirectory(filePath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      analyzeFile(filePath);
    }
  });
}

// Main execution

walkDirectory(path.join(__dirname, '..', 'app'));
walkDirectory(path.join(__dirname, '..', 'lib'));
walkDirectory(path.join(__dirname, '..', 'components'));
walkDirectory(path.join(__dirname, '..', 'hooks'));

// Group by category
const byCategory = results.reduce((acc, item) => {
  if (!acc[item.category]) {
    acc[item.category] = [];
  }
  acc[item.category].push(item);
  return acc;
}, {} as Record<string, AnyTypeLocation[]>);

// Group by file
const byFile = results.reduce((acc, item) => {
  if (!acc[item.file]) {
    acc[item.file] = [];
  }
  acc[item.file].push(item);
  return acc;
}, {} as Record<string, AnyTypeLocation[]>);

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


#!/usr/bin/env node
/**
 * Analyze and split large files
 * Files >1000 lines should be split into smaller, focused modules
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

function analyzeLargeFiles() {
  const files = getAllFiles(process.cwd(), ['.ts', '.tsx', '.js', '.jsx']);
  const largeFiles = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n').length;
    
    if (lines > 1000) {
      largeFiles.push({
        path: file.replace(process.cwd() + '/', ''),
        lines,
        size: (content.length / 1024).toFixed(2) + ' KB',
      });
    }
  }
  
  largeFiles.sort((a, b) => b.lines - a.lines);
  
  return largeFiles;
}

function generateSplitRecommendations(largeFiles) {
  console.log('\n📊 Large Files Analysis (>1000 lines)\n');
  console.log('='.repeat(80));
  
  const recommendations = [];
  
  for (const file of largeFiles) {
    console.log(`\n📄 ${file.path}`);
    console.log(`   Lines: ${file.lines} | Size: ${file.size}`);
    
    const content = fs.readFileSync(file.path, 'utf-8');
    const lines = content.split('\n');
    
    // Analyze structure
    const imports = lines.filter(l => l.trim().startsWith('import ')).length;
    const exports = lines.filter(l => l.trim().startsWith('export ')).length;
    const functions = lines.filter(l => l.trim().startsWith('function ') || l.trim().startsWith('const ') && l.includes('= (')).length;
    const components = lines.filter(l => l.trim().startsWith('function ') && l[0] === l[0].toUpperCase()).length;
    
    console.log(`   Imports: ${imports} | Exports: ${exports} | Functions: ${functions} | Components: ${components}`);
    
    // Generate recommendations
    const rec = {
      file: file.path,
      lines: file.lines,
      recommendation: '',
    };
    
    if (file.path.includes('Client.tsx')) {
      rec.recommendation = `Split into: hooks/, components/, and utils/ subdirectories`;
      console.log(`   💡 Recommendation: Split into hooks/, components/, and utils/ subdirectories`);
    } else if (file.path.includes('tool-executors')) {
      rec.recommendation = `Split by tool category: table-tools/, order-tools/, menu-tools/, etc.`;
      console.log(`   💡 Recommendation: Split by tool category: table-tools/, order-tools/, menu-tools/, etc.`);
    } else if (file.path.includes('route.ts')) {
      rec.recommendation = `Extract business logic into service layer`;
      console.log(`   💡 Recommendation: Extract business logic into service layer`);
    } else {
      rec.recommendation = `Split into focused modules by feature/concern`;
      console.log(`   💡 Recommendation: Split into focused modules by feature/concern`);
    }
    
    recommendations.push(rec);
  }
  
  return recommendations;
}

function createSplitPlan(recommendations) {
  const planPath = path.join(process.cwd(), 'LARGE_FILES_SPLIT_PLAN.md');
  const planContent = `# Large Files Split Plan

Generated: ${new Date().toISOString()}

## Summary

Total large files (>1000 lines): ${recommendations.length}

## Files to Split

${recommendations.map(r => `
### ${r.file} (${r.lines} lines)

**Recommendation:** ${r.recommendation}

**Strategy:**
1. Identify logical boundaries (features, concerns, responsibilities)
2. Extract into separate files/modules
3. Update imports across codebase
4. Test thoroughly

**Priority:** ${r.lines > 1500 ? '🔴 HIGH' : r.lines > 1200 ? '🟡 MEDIUM' : '🟢 LOW'}
`).join('\n')}

## Implementation Priority

### Phase 1: Critical (>1500 lines)
${recommendations.filter(r => r.lines > 1500).map(r => `- [ ] ${r.file}`).join('\n')}

### Phase 2: Important (1200-1500 lines)
${recommendations.filter(r => r.lines > 1200 && r.lines <= 1500).map(r => `- [ ] ${r.file}`).join('\n')}

### Phase 3: Nice to Have (1000-1200 lines)
${recommendations.filter(r => r.lines <= 1200).map(r => `- [ ] ${r.file}`).join('\n')}

## General Split Guidelines

1. **Component Files:** Split into smaller components in a components/ subdirectory
2. **Hook Files:** Extract custom hooks into hooks/ subdirectory
3. **Utility Files:** Group related utilities into focused modules
4. **API Routes:** Extract business logic into service layer
5. **Tool Executors:** Group by domain (tables, orders, menu, etc.)

## Target Sizes

- **Components:** < 300 lines
- **Hooks:** < 200 lines
- **Utils:** < 300 lines
- **API Routes:** < 200 lines (business logic in services)
- **Services:** < 500 lines

## Benefits

- ✅ Better maintainability
- ✅ Easier to test
- ✅ Faster IDE performance
- ✅ Clearer separation of concerns
- ✅ Easier code reviews
- ✅ Better reusability
`;

  fs.writeFileSync(planPath, planContent, 'utf-8');
  console.log(`\n✅ Split plan created: ${planPath}`);
}

// Main execution
const largeFiles = analyzeLargeFiles();
const recommendations = generateSplitRecommendations(largeFiles);
createSplitPlan(recommendations);

console.log('\n' + '='.repeat(80));
console.log(`\n📊 Summary: Found ${largeFiles.length} files >1000 lines`);
console.log(`\n💡 Next steps:`);
console.log(`   1. Review LARGE_FILES_SPLIT_PLAN.md`);
console.log(`   2. Start with Phase 1 (critical files)`);
console.log(`   3. Split one file at a time`);
console.log(`   4. Test after each split`);


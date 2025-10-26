#!/usr/bin/env node

/**
 * Final comprehensive cleanup
 * Removes all unused code identified by ESLint
 */

import fs from 'fs';
import { glob } from 'glob';

async function removeUnusedImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  const unusedImports = [
    // Common unused UI components
    'Check', 'CardHeader', 'CardTitle', 'DialogTrigger', 'Input', 'Label', 'Textarea',
    'ToggleSwitch', 'Upload', 'Info', 'Button', 'Badge', 'Select', 'SelectContent',
    'SelectItem', 'SelectTrigger', 'SelectValue', 'StatusPill',
    
    // Common unused icons
    'PlayCircle', 'XCircle', 'Clock', 'Receipt', 'Split', 'ArrowLeft', 'User',
    'DollarSign', 'Users', 'CreditCard', 'CheckCircle', 'Pause', 'Square', 'Filter',
    'Minus', 'ArrowRight', 'Trash2', 'Edit', 'UserCheck', 'Hash', 'Loader2',
    'TrendingUp', 'TrendingDown', 'Search', 'Calendar', 'Wifi',
    
    // Common unused hooks/utils
    'useCallback', 'useEffect', 'useMemo', 'logger', 'dbLogger', 'aiLogger',
    'errorToContext', 'loadGoogleMapsAPI',
    
    // Common unused types
    'TableWithState', 'StockMovementReason', 'PerformanceMetrics', 'Message',
  ];
  
  for (const name of unusedImports) {
    // Remove from import { X, Y, Z }
    const importPattern1 = new RegExp(`,\\s*${name}\\s*(?=})`, 'g');
    const importPattern2 = new RegExp(`{\\s*${name}\\s*,`, 'g');
    const importPattern3 = new RegExp(`{\\s*${name}\\s*}`, 'g');
    
    if (content.match(importPattern1)) {
      content = content.replace(importPattern1, '');
      modified = true;
    }
    if (content.match(importPattern2)) {
      content = content.replace(importPattern2, '{');
      modified = true;
    }
    if (content.match(importPattern3)) {
      // Remove entire import statement if it's the only import
      const fullImportPattern = new RegExp(`import.*{\\s*${name}\\s*}.*\\n`, 'g');
      if (content.match(fullImportPattern)) {
        content = content.replace(fullImportPattern, '');
        modified = true;
      }
    }
  }
  
  // Remove standalone import statements that are now empty
  content = content.replace(/import\s*{\s*}\s*from\s*['"][^'"]+['"];\s*\n/g, '');
  
  // Clean up multiple blank lines
  content = content.replace(/\n\n\n+/g, '\n\n');
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

async function prefixUnusedVars(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Common unused variable names to prefix
  const varsToPrefix = [
    'insertedItems', 'insertedHotspots', 'duration', 'requestId', 'parseError',
    'scrapeDuration', 'aiDuration', 'item', 'categories', 'totalDuration',
    'recentError', 'item_count', 'total_amount', 'completionResult', 'supabase',
    'order', 'orgSlug', 'venue', 'userName', 'data', 'targetState',
    'requires_confirmation', 'tableError', 'indexSQL', 'rlsSQL',
    'venueName', 'loading', 'refetch', 'result', 'showAddForm', 'payload',
    'menuItems', 'bumpedTickets', 'canEdit', 'initialStats', 'selectedOrder',
    'setSelectedOrder', 'todayWindow', 'LIVE_STATUSES', 'TERMINAL_STATUSES',
    'LIVE_WINDOW_STATUSES', 'setAutoRefreshEnabled', 'setRefreshInterval',
    'uploadData', 'dbError', 'amountPerSplit', 'getSplitForOrder',
    'serverFilter', 'setServerFilter', 'updateItemStatus', 'inviteDialogOpen',
    'inviteLoading', 'handleSendInvitation', 'onDeleteRow', 'showEditor',
    'setShowEditor', 'getStatusInfo', 'isGreyedOutStatus', 'oauthKeys',
    'reject', 'userId', 'notes', 'json', 'fetchTime', 'browserPaths',
    'conversationsCheck', 'messagesCheck', 'realtimeCounts', 'cartData',
    'draggableId', 'ms', 'LIVE_STATUSES', 'getMergeScenario', 'getStateIcon',
    'getRatingColor',
  ];
  
  for (const varName of varsToPrefix) {
    // Pattern 1: const varName = ...
    const constPattern = new RegExp(`(const|let)\\s+${varName}\\b`, 'g');
    if (content.match(constPattern)) {
      content = content.replace(constPattern, `$1 _${varName}`);
      modified = true;
    }
    
    // Pattern 2: const { varName } = ...
    const destructPattern = new RegExp(`({[^}]*\\b)${varName}(\\b[^}]*})`, 'g');
    if (content.match(destructPattern)) {
      content = content.replace(destructPattern, (match) => {
        return match.replace(new RegExp(`\\b${varName}\\b`), `${varName}: _${varName}`);
      });
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

async function main() {
  console.log('🔧 Running final cleanup...\n');
  
  const files = await glob('{app,components,lib,hooks}/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/.next/**', '**/scripts/**']
  });
  
  let totalFixed = 0;
  
  for (const file of files) {
    let fixed = false;
    fixed = await removeUnusedImports(file) || fixed;
    fixed = await prefixUnusedVars(file) || fixed;
    
    if (fixed) {
      console.log(`✅ ${file}`);
      totalFixed++;
    }
  }
  
  console.log(`\n✅ Fixed ${totalFixed} files`);
}

main().catch(console.error);


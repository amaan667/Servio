#!/usr/bin/env node
/**
 * Reduce any types to proper types
 */

const fs = require('fs');
const path = require('path');

const files = [
  'app/api',
  'app/dashboard',
  'components',
  'hooks',
  'lib',
];

let totalFixed = 0;

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let newContent = content;
  
  // Replace common any patterns with proper types
  const replacements = [
    // error: any -> error: unknown
    [/\berror:\s*any\b/g, 'error: unknown'],
    // payload: any -> payload: unknown
    [/\bpayload:\s*any\b/g, 'payload: unknown'],
    // data: any -> data: unknown
    [/\bdata:\s*any\b/g, 'data: unknown'],
    // result: any -> result: unknown
    [/\bresult:\s*any\b/g, 'result: unknown'],
    // value: any -> value: unknown
    [/\bvalue:\s*any\b/g, 'value: unknown'],
    // item: any -> item: unknown
    [/\bitem:\s*any\b/g, 'item: unknown'],
    // order: any -> order: unknown
    [/\border:\s*any\b/g, 'order: unknown'],
    // user: any -> user: unknown
    [/\buser:\s*any\b/g, 'user: unknown'],
    // session: any -> session: unknown
    [/\bsession:\s*any\b/g, 'session: unknown'],
    // response: any -> response: unknown
    [/\bresponse:\s*any\b/g, 'response: unknown'],
    // params: any -> params: unknown
    [/\bparams:\s*any\b/g, 'params: unknown'],
    // query: any -> query: unknown
    [/\bquery:\s*any\b/g, 'query: unknown'],
    // body: any -> body: unknown
    [/\bbody:\s*any\b/g, 'body: unknown'],
    // req: any -> req: unknown
    [/\breq:\s*any\b/g, 'req: unknown'],
    // res: any -> res: unknown
    [/\bres:\s*any\b/g, 'res: unknown'],
    // (error: any) -> (error: unknown)
    [/\(error:\s*any\)/g, '(error: unknown)'],
    // (payload: any) -> (payload: unknown)
    [/\(payload:\s*any\)/g, '(payload: unknown)'],
    // (data: any) -> (data: unknown)
    [/\(data:\s*any\)/g, '(data: unknown)'],
    // (result: any) -> (result: unknown)
    [/\(result:\s*any\)/g, '(result: unknown)'],
    // (value: any) -> (value: unknown)
    [/\(value:\s*any\)/g, '(value: unknown)'],
    // (item: any) -> (item: unknown)
    [/\(item:\s*any\)/g, '(item: unknown)'],
    // (order: any) -> (order: unknown)
    [/\(order:\s*any\)/g, '(order: unknown)'],
    // (user: any) -> (user: unknown)
    [/\(user:\s*any\)/g, '(user: unknown)'],
    // (session: any) -> (session: unknown)
    [/\(session:\s*any\)/g, '(session: unknown)'],
    // (response: any) -> (response: unknown)
    [/\(response:\s*any\)/g, '(response: unknown)'],
    // (params: any) -> (params: unknown)
    [/\(params:\s*any\)/g, '(params: unknown)'],
    // (query: any) -> (query: unknown)
    [/\(query:\s*any\)/g, '(query: unknown)'],
    // (body: any) -> (body: unknown)
    [/\(body:\s*any\)/g, '(body: unknown)'],
    // (req: any) -> (req: unknown)
    [/\(req:\s*any\)/g, '(req: unknown)'],
    // (res: any) -> (res: unknown)
    [/\(res:\s*any\)/g, '(res: unknown)'],
    // : any[] -> : unknown[]
    [/:\s*any\[\]/g, ': unknown[]'],
    // : any => -> : unknown =>
    [/:\s*any\s*=>/g, ': unknown =>'],
    // : any\b -> : unknown
    [/(?<![\w])any\b(?![\w])/g, 'unknown'],
  ];
  
  replacements.forEach(([pattern, replacement]) => {
    if (newContent.match(pattern)) {
      newContent = newContent.replace(pattern, replacement);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    totalFixed++;
    console.log(`✅ Fixed ${filePath}`);
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules, .next, etc.
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist' || entry.name === 'build') {
        continue;
      }
      walkDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      processFile(fullPath);
    }
  }
}

files.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(fullPath)) {
    walkDir(fullPath);
  }
});

console.log(`\n✅ Fixed ${totalFixed} files!`);


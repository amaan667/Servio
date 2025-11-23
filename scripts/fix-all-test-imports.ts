/**
 * Fix import paths in all generated test files
 */

import { readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";

async function fixTestFile(filePath: string): Promise<void> {
  try {
    let content = await readFile(filePath, "utf-8");
    let modified = false;

    // Fix import paths missing slashes
    if (content.includes('from "@/app/apireservations')) {
      content = content.replace(/from "@\/app\/api([^/])/g, 'from "@/app/api/$1');
      modified = true;
    }
    if (content.includes('from "@/app/apiorders')) {
      content = content.replace(/from "@\/app\/api([^/])/g, 'from "@/app/api/$1');
      modified = true;
    }
    if (content.includes('from "@/app/api/')) {
      // Fix double slashes
      content = content.replace(/\/api\/\//g, '/api/');
      modified = true;
    }

    // Uncomment test code
    if (content.includes('// const response = await')) {
      content = content.replace(/\/\/ const response = await (\w+)\(request\);/g, 'const response = await $1(request);');
      modified = true;
    }
    if (content.includes('// expect([')) {
      content = content.replace(/\/\/ expect\(\[200/g, 'expect([200');
      modified = true;
    }

    if (modified) {
      await writeFile(filePath, content);
      console.log(`Fixed: ${filePath}`);
    }
  } catch (err) {
    console.error(`Error fixing ${filePath}:`, err);
  }
}

async function main() {
  const testDir = join(process.cwd(), "__tests__/api");
  const files = await readdir(testDir);
  
  for (const file of files) {
    if (file.endsWith(".test.ts")) {
      await fixTestFile(join(testDir, file));
    }
  }
  
  console.log("Done fixing test imports");
}

main().catch(console.error);

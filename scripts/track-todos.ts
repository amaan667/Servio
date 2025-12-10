/**
 * Script to extract and track TODO/FIXME comments
 * Generates a markdown file with all TODOs for tracking
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname, relative } from "path";
import { logger } from "@/lib/logger";

const EXCLUDE_DIRS = ["node_modules", ".next", "coverage", "dist", "build", "__tests__", "docs"];
const INCLUDE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

interface TodoItem {
  file: string;
  line: number;
  type: "TODO" | "FIXME" | "HACK" | "XXX" | "NOTE";
  message: string;
  context: string;
}

const todos: TodoItem[] = [];

function shouldProcessFile(filePath: string): boolean {
  const ext = extname(filePath);
  return INCLUDE_EXTENSIONS.includes(ext);
}

function shouldSkipDir(dirName: string): boolean {
  return EXCLUDE_DIRS.includes(dirName) || dirName.startsWith(".");
}

function processFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const relativePath = relative(process.cwd(), filePath);

    lines.forEach((line, index) => {
      // Match TODO, FIXME, HACK, XXX, NOTE comments
      const todoMatch = line.match(/(?:^|\s)(TODO|FIXME|HACK|XXX|NOTE):\s*(.+)/i);
      
      if (todoMatch) {
        const type = todoMatch[1].toUpperCase() as TodoItem["type"];
        const message = todoMatch[2].trim();
        
        // Get context (previous and next lines)
        const contextLines: string[] = [];
        for (let i = Math.max(0, index - 2); i <= Math.min(lines.length - 1, index + 2); i++) {
          if (i === index) {
            contextLines.push(`> ${lines[i].trim()}`);
          } else {
            contextLines.push(`  ${lines[i].trim()}`);
          }
        }
        
        todos.push({
          file: relativePath,
          line: index + 1,
          type,
          message,
          context: contextLines.join("\n"),
        });
      }
    });
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

function walkDirectory(dirPath: string): void {
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!shouldSkipDir(entry)) {
        walkDirectory(fullPath);
      }
    } else if (stat.isFile() && shouldProcessFile(fullPath)) {
      processFile(fullPath);
    }
  }
}

// Main execution
const rootDir = join(process.cwd());
logger.debug("Scanning for TODO/FIXME comments...\n");

walkDirectory(rootDir);

// Generate markdown report
const report = `# TODO/FIXME Tracking Report

Generated: ${new Date().toISOString()}

Total items: ${todos.length}

## Summary by Type

${["TODO", "FIXME", "HACK", "XXX", "NOTE"]
  .map(
    (type) =>
      `- **${type}**: ${todos.filter((t) => t.type === type).length}`
  )
  .join("\n")}

## Items by File

${Array.from(new Set(todos.map((t) => t.file)))
  .sort()
  .map((file) => {
    const fileTodos = todos.filter((t) => t.file === file);
    return `### ${file} (${fileTodos.length} items)

${fileTodos
  .map(
    (todo) => `#### Line ${todo.line}: ${todo.type}

**Message**: ${todo.message}

\`\`\`
${todo.context}
\`\`\`
`
  )
  .join("\n---\n\n")}`;
  })
  .join("\n\n")}

## Action Items

${todos
  .map(
    (todo) =>
      `- [ ] ${todo.type} in \`${todo.file}:${todo.line}\`: ${todo.message}`
  )
  .join("\n")}

---

**Note**: This report is auto-generated. Review and prioritize items, then create GitHub issues for tracking.
`;

writeFileSync(join(rootDir, "docs/TODOS.md"), report, "utf-8");

logger.debug({ data: `\n✓ Found ${todos.length} TODO/FIXME items` });
logger.debug({ data: `✓ Report generated: docs/TODOS.md` });

// Print summary
const byType = new Map<string, number>();
todos.forEach((todo) => {
  byType.set(todo.type, (byType.get(todo.type) || 0) + 1);
});

logger.debug("\nSummary by type:");
byType.forEach((count, type) => {
  logger.debug({ data: `  ${type}: ${count}` });
});


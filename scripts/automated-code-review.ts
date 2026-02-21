#!/usr/bin/env tsx

/**
 * Automated Code Review Tool
 * Performs automated code analysis and reviews
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

interface ReviewIssue {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info";
  message: string;
  rule: string;
}

interface ReviewResult {
  file: string;
  issues: ReviewIssue[];
  metrics: {
    linesOfCode: number;
    complexity: number;
    maintainabilityIndex: number;
  };
}

interface ReviewConfig {
  includePatterns: string[];
  excludePatterns: string[];
  rules: string[];
}

/**
 * Code Reviewer
 */
export class CodeReviewer {
  private config: ReviewConfig;

  constructor(config: Partial<ReviewConfig> = {}) {
    this.config = {
      includePatterns: ["**/*.{ts,tsx,js,jsx}"],
      excludePatterns: [
        "**/node_modules/**",
        "**/.next/**",
        "**/dist/**",
        "**/build/**",
        "**/*.test.{ts,tsx,js,jsx}",
        "**/*.spec.{ts,tsx,js,jsx}",
      ],
      rules: [
        "no-console",
        "no-debugger",
        "no-var",
        "prefer-const",
        "no-unused-vars",
        "no-duplicate-imports",
        "max-line-length",
        "max-complexity",
        "prefer-arrow-functions",
        "no-magic-numbers",
      ],
      ...config,
    };
  }

  /**
   * Run code review
   */
  async review(): Promise<ReviewResult[]> {
    const results: ReviewResult[] = [];

    // Get all files to review
    const files = this.getFilesToReview();

    for (const file of files) {
      const result = await this.reviewFile(file);
      results.push(result);
    }

    return results;
  }

  /**
   * Get files to review
   */
  private getFilesToReview(): string[] {
    const files: string[] = [];

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Check if directory should be excluded
          if (!this.shouldExclude(fullPath)) {
            walk(fullPath);
          }
        } else {
          // Check if file should be included
          if (this.shouldInclude(fullPath)) {
            files.push(fullPath);
          }
        }
      }
    };

    walk(process.cwd());
    return files;
  }

  /**
   * Check if file should be excluded
   */
  private shouldExclude(filePath: string): boolean {
    return this.config.excludePatterns.some((pattern) => {
      const regex = new RegExp(pattern.replace(/\*\*/g, ".*"));
      return regex.test(filePath);
    });
  }

  /**
   * Check if file should be included
   */
  private shouldInclude(filePath: string): boolean {
    return this.config.includePatterns.some((pattern) => {
      const regex = new RegExp(pattern.replace(/\*\*/g, ".*"));
      return regex.test(filePath);
    });
  }

  /**
   * Review a single file
   */
  async reviewFile(filePath: string): Promise<ReviewResult> {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const issues: ReviewIssue[] = [];

    // Run ESLint
    const eslintIssues = await this.runESLint(filePath);
    issues.push(...eslintIssues);

    // Run TypeScript compiler
    const tsIssues = await this.runTypeScriptCheck(filePath);
    issues.push(...tsIssues);

    // Run custom rules
    const customIssues = this.runCustomRules(filePath, content, lines);
    issues.push(...customIssues);

    // Calculate metrics
    const metrics = this.calculateMetrics(content, lines);

    return {
      file: filePath,
      issues,
      metrics,
    };
  }

  /**
   * Run ESLint
   */
  private async runESLint(filePath: string): Promise<ReviewIssue[]> {
    const issues: ReviewIssue[] = [];

    try {
      const output = execSync(`npx eslint "${filePath}" --format json`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      const results = JSON.parse(output);

      for (const result of results) {
        for (const message of result.messages) {
          issues.push({
            file: filePath,
            line: message.line,
            column: message.column,
            severity:
              message.severity === 2 ? "error" : message.severity === 1 ? "warning" : "info",
            message: message.message,
            rule: message.ruleId,
          });
        }
      }
    } catch (error) {
      // ESLint failed, skip
    }

    return issues;
  }

  /**
   * Run TypeScript check
   */
  private async runTypeScriptCheck(filePath: string): Promise<ReviewIssue[]> {
    const issues: ReviewIssue[] = [];

    try {
      const output = execSync(`npx tsc --noEmit "${filePath}"`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Parse TypeScript errors
      const lines = output.split("\n");
      for (const line of lines) {
        const match = line.match(/(.+)\((\d+),(\d+)\):\s+error\s+TS\d+:\s+(.+)/);
        if (match) {
          issues.push({
            file: filePath,
            line: parseInt(match[2], 10),
            column: parseInt(match[3], 10),
            severity: "error",
            message: match[4],
            rule: "typescript",
          });
        }
      }
    } catch (error) {
      // TypeScript check failed, skip
    }

    return issues;
  }

  /**
   * Run custom rules
   */
  private runCustomRules(filePath: string, content: string, lines: string[]): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    for (const rule of this.config.rules) {
      switch (rule) {
        case "no-console":
          issues.push(...this.checkNoConsole(filePath, lines));
          break;

        case "no-debugger":
          issues.push(...this.checkNoDebugger(filePath, lines));
          break;

        case "no-var":
          issues.push(...this.checkNoVar(filePath, lines));
          break;

        case "prefer-const":
          issues.push(...this.checkPreferConst(filePath, lines));
          break;

        case "no-unused-vars":
          issues.push(...this.checkNoUnusedVars(filePath, content));
          break;

        case "no-duplicate-imports":
          issues.push(...this.checkNoDuplicateImports(filePath, content));
          break;

        case "max-line-length":
          issues.push(...this.checkMaxLineLength(filePath, lines, 120));
          break;

        case "max-complexity":
          issues.push(...this.checkMaxComplexity(filePath, content, 10));
          break;

        case "prefer-arrow-functions":
          issues.push(...this.checkPreferArrowFunctions(filePath, content));
          break;

        case "no-magic-numbers":
          issues.push(...this.checkNoMagicNumbers(filePath, lines));
          break;
      }
    }

    return issues;
  }

  /**
   * Check for console statements
   */
  private checkNoConsole(filePath: string, lines: string[]): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    lines.forEach((line, index) => {
      if (
        line.includes("console.log") ||
        line.includes("console.error") ||
        line.includes("console.warn")
      ) {
        issues.push({
          file: filePath,
          line: index + 1,
          column: 0,
          severity: "warning",
          message: "Remove console statement before production",
          rule: "no-console",
        });
      }
    });

    return issues;
  }

  /**
   * Check for debugger statements
   */
  private checkNoDebugger(filePath: string, lines: string[]): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    lines.forEach((line, index) => {
      if (line.includes("debugger")) {
        issues.push({
          file: filePath,
          line: index + 1,
          column: 0,
          severity: "error",
          message: "Remove debugger statement",
          rule: "no-debugger",
        });
      }
    });

    return issues;
  }

  /**
   * Check for var declarations
   */
  private checkNoVar(filePath: string, lines: string[]): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    lines.forEach((line, index) => {
      if (line.match(/\bvar\s+/)) {
        issues.push({
          file: filePath,
          line: index + 1,
          column: 0,
          severity: "warning",
          message: "Use let or const instead of var",
          rule: "no-var",
        });
      }
    });

    return issues;
  }

  /**
   * Check for const preference
   */
  private checkPreferConst(filePath: string, lines: string[]): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    lines.forEach((line, index) => {
      if (line.match(/\blet\s+\w+\s*=/)) {
        issues.push({
          file: filePath,
          line: index + 1,
          column: 0,
          severity: "info",
          message: "Consider using const if the variable is not reassigned",
          rule: "prefer-const",
        });
      }
    });

    return issues;
  }

  /**
   * Check for unused variables
   */
  private checkNoUnusedVars(filePath: string, content: string): ReviewIssue[] {
    // This is a simplified check
    // In production, use a proper AST parser
    const issues: ReviewIssue[] = [];

    const unusedPattern = /(?:const|let|var)\s+(\w+)\s*=/g;
    const matches = content.match(unusedPattern) || [];

    // Check if variables are used
    matches.forEach((match) => {
      const varName = match.replace(/(?:const|let|var)\s+(\w+)\s*=/, "$1");
      const usageRegex = new RegExp(`\\b${varName}\\b`, "g");
      const usageCount = (content.match(usageRegex) || []).length;

      if (usageCount === 1) {
        issues.push({
          file: filePath,
          line: 0,
          column: 0,
          severity: "warning",
          message: `Variable '${varName}' is declared but never used`,
          rule: "no-unused-vars",
        });
      }
    });

    return issues;
  }

  /**
   * Check for duplicate imports
   */
  private checkNoDuplicateImports(filePath: string, content: string): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    const importPattern = /import\s+.*from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    const importLines: number[] = [];

    content.split("\n").forEach((line, index) => {
      const matches = line.match(importPattern);
      if (matches) {
        const importPath = matches[1];
        if (imports.includes(importPath)) {
          issues.push({
            file: filePath,
            line: index + 1,
            column: 0,
            severity: "warning",
            message: `Duplicate import: ${importPath}`,
            rule: "no-duplicate-imports",
          });
        } else {
          imports.push(importPath);
          importLines.push(index + 1);
        }
      }
    });

    return issues;
  }

  /**
   * Check for max line length
   */
  private checkMaxLineLength(filePath: string, lines: string[], maxLength: number): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    lines.forEach((line, index) => {
      if (line.length > maxLength) {
        issues.push({
          file: filePath,
          line: index + 1,
          column: maxLength,
          severity: "warning",
          message: `Line exceeds ${maxLength} characters (${line.length} characters)`,
          rule: "max-line-length",
        });
      }
    });

    return issues;
  }

  /**
   * Check for max complexity
   */
  private checkMaxComplexity(
    filePath: string,
    content: string,
    maxComplexity: number
  ): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    // Simplified complexity check
    // In production, use a proper complexity analyzer
    const functionPattern = /function\s+\w+\s*\([^)]*\)\s*{([^}]*(?:{[^}]*})*[^}]*)}/g;
    const matches = content.match(functionPattern) || [];

    matches.forEach((match) => {
      const functionBody = match;
      const complexity = this.calculateComplexity(functionBody);

      if (complexity > maxComplexity) {
        issues.push({
          file: filePath,
          line: 0,
          column: 0,
          severity: "warning",
          message: `Function complexity (${complexity}) exceeds maximum (${maxComplexity})`,
          rule: "max-complexity",
        });
      }
    });

    return issues;
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateComplexity(code: string): number {
    let complexity = 1;

    // Count decision points
    const decisionPatterns = [
      /\bif\s*\(/g,
      /\belse\b/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\b&&/g,
      /\|\|/g,
      /\?/g,
    ];

    for (const pattern of decisionPatterns) {
      const matches = code.match(pattern) || [];
      complexity += matches.length;
    }

    return complexity;
  }

  /**
   * Check for arrow function preference
   */
  private checkPreferArrowFunctions(filePath: string, content: string): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    const functionPattern = /function\s*\(\s*\w+\s*\)\s*{/g;
    const matches = content.match(functionPattern) || [];

    matches.forEach((match) => {
      issues.push({
        file: filePath,
        line: 0,
        column: 0,
        severity: "info",
        message: "Consider using arrow function for better readability",
        rule: "prefer-arrow-functions",
      });
    });

    return issues;
  }

  /**
   * Check for magic numbers
   */
  private checkNoMagicNumbers(filePath: string, lines: string[]): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    lines.forEach((line, index) => {
      // Match numbers that are not 0, 1, or -1
      const numberPattern = /(?<![a-zA-Z0-9])(?!0|1|-1)(\d+)(?![a-zA-Z0-9])/g;
      const matches = line.match(numberPattern) || [];

      matches.forEach((match) => {
        issues.push({
          file: filePath,
          line: index + 1,
          column: 0,
          severity: "info",
          message: `Magic number '${match}' detected. Consider using a named constant.`,
          rule: "no-magic-numbers",
        });
      });
    });

    return issues;
  }

  /**
   * Calculate code metrics
   */
  private calculateMetrics(content: string, lines: string[]): ReviewResult["metrics"] {
    const linesOfCode = lines.filter((line) => line.trim() !== "").length;
    const complexity = this.calculateComplexity(content);
    const maintainabilityIndex = Math.max(0, 171 - 5.2 * Math.log(complexity) - 0.23 * complexity);

    return {
      linesOfCode,
      complexity,
      maintainabilityIndex,
    };
  }

  /**
   * Generate review report
   */
  generateReport(results: ReviewResult[]): string {
    let report = "# Automated Code Review Report\n\n";
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Summary
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const errors = results.reduce(
      (sum, r) => sum + r.issues.filter((i) => i.severity === "error").length,
      0
    );
    const warnings = results.reduce(
      (sum, r) => sum + r.issues.filter((i) => i.severity === "warning").length,
      0
    );
    const infos = results.reduce(
      (sum, r) => sum + r.issues.filter((i) => i.severity === "info").length,
      0
    );

    report += "## Summary\n\n";
    report += `- Total Files: ${results.length}\n`;
    report += `- Total Issues: ${totalIssues}\n`;
    report += `- Errors: ${errors}\n`;
    report += `- Warnings: ${warnings}\n`;
    report += `- Info: ${infos}\n\n`;

    // Issues by file
    report += "## Issues by File\n\n";
    for (const result of results) {
      if (result.issues.length > 0) {
        report += `### ${result.file}\n\n`;
        for (const issue of result.issues) {
          const icon =
            issue.severity === "error" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️";
          report += `${icon} Line ${issue.line}: ${issue.message} (${issue.rule})\n`;
        }
        report += "\n";
      }
    }

    // Metrics
    report += "## Metrics\n\n";
    for (const result of results) {
      report += `### ${result.file}\n\n`;
      report += `- Lines of Code: ${result.metrics.linesOfCode}\n`;
      report += `- Complexity: ${result.metrics.complexity}\n`;
      report += `- Maintainability Index: ${result.metrics.maintainabilityIndex.toFixed(2)}\n\n`;
    }

    return report;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const reviewer = new CodeReviewer();

  switch (command) {
    case "review":
      console.log("Running automated code review...\n");
      const results = await reviewer.review();
      const report = reviewer.generateReport(results);
      console.log(report);
      break;

    case "check":
      const filePath = args[1];
      if (!filePath) {
        console.log("Usage: tsx scripts/automated-code-review.ts check <file>");
        process.exit(1);
      }
      const result = await reviewer.reviewFile(filePath);
      console.log(JSON.stringify(result, null, 2));
      break;

    default:
      console.log("Usage: tsx scripts/automated-code-review.ts <command>");
      console.log("");
      console.log("Commands:");
      console.log("  review  Run full code review");
      console.log("  check   Check a specific file");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Code review failed:", error);
  process.exit(1);
});

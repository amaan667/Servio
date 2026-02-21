#!/usr/bin/env tsx

/**
 * Code Generation Tool
 * Generates boilerplate code for common patterns
 */

import * as fs from "fs";
import * as path from "path";

interface GeneratorConfig {
  outputDir: string;
  typescript?: boolean;
  useServerComponents?: boolean;
  useClientComponents?: boolean;
}

/**
 * Code Generator
 */
export class CodeGenerator {
  private config: GeneratorConfig;

  constructor(config: GeneratorConfig) {
    this.config = {
      typescript: true,
      useServerComponents: true,
      useClientComponents: true,
      ...config,
    };
  }

  /**
   * Generate API route
   */
  generateAPIRoute(name: string, methods: string[] = ["GET", "POST"]): string {
    const className = this.toPascalCase(name);
    const fileName = this.toKebabCase(name);
    const ext = this.config.typescript ? "ts" : "js";

    const imports = this.config.typescript
      ? `import { NextRequest, NextResponse } from 'next/server';\nimport { createClient } from '@supabase/supabase-js';\n`
      : "";

    const typeDefs = this.config.typescript
      ? `interface ${className}Request {\n  [key: string]: unknown;\n}\n\ninterface ${className}Response {\n  success: boolean;\n  data?: unknown;\n  error?: string;\n}\n`
      : "";

    const handler = `export async function ${methods[0].toLowerCase()}(request: NextRequest) {\n  try {\n    const body = await request.json();\n    const { data, error } = await ${className}Handler(body);\n\n    if (error) {\n      return NextResponse.json({ success: false, error }, { status: 500 });\n    }\n\n    return NextResponse.json({ success: true, data });\n  } catch (error) {\n    return NextResponse.json(\n      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },\n      { status: 500 }\n    );\n  }\n}\n\nasync function ${className}Handler(request: ${className}Request): Promise<${className}Response> {\n  // TODO: Implement ${className} handler\n  return { success: true, data: null };\n}`;

    return `${imports}${typeDefs}${handler}`;
  }

  /**
   * Generate React component
   */
  generateComponent(name: string, isServer: boolean = false): string {
    const className = this.toPascalCase(name);
    const fileName = this.toKebabCase(name);
    const ext = this.config.typescript ? "tsx" : "jsx";

    const directive = isServer ? "'use server';\n\n" : "'use client';\n\n";
    const imports = this.config.typescript
      ? `import React from 'react';\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\n`
      : "";

    const component = `export default function ${className}() {\n  return (\n    <Card>\n      <CardHeader>\n        <CardTitle>${className}</CardTitle>\n      </CardHeader>\n      <CardContent>\n        {/* TODO: Implement ${className} content */}\n      </CardContent>\n    </Card>\n  );\n}`;

    return `${directive}${imports}${component}`;
  }

  /**
   * Generate service
   */
  generateService(name: string): string {
    const className = this.toPascalCase(name);
    const fileName = this.toKebabCase(name);
    const ext = this.config.typescript ? "ts" : "js";

    const imports = this.config.typescript
      ? `import { createClient } from '@supabase/supabase-js';\nimport { logger } from '@/lib/monitoring/structured-logger';\n`
      : "";

    const service = `export class ${className}Service {\n  private supabase: ReturnType<typeof createClient>;\n\n  constructor() {\n    const supabaseUrl = process.env.SUPABASE_URL;\n    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;\n\n    if (!supabaseUrl || !supabaseAnonKey) {\n      throw new Error('Missing Supabase configuration');\n    }\n\n    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {\n      auth: {\n        autoRefreshToken: false,\n        persistSession: false,\n      },\n    });\n  }\n\n  async getById(id: string) {\n    const { data, error } = await this.supabase\n      .from('${fileName}s')\n      .select('*')\n      .eq('id', id)\n      .single();\n\n    if (error) {\n      logger.error('Failed to fetch ${fileName}', { id, error });\n      throw error;\n    }\n\n    return data;\n  }\n\n  async getAll(filters?: Record<string, unknown>) {\n    let query = this.supabase\n      .from('${fileName}s')\n      .select('*');\n\n    if (filters) {\n      Object.entries(filters).forEach(([key, value]) => {\n        query = query.eq(key, value);\n      });\n    }\n\n    const { data, error } = await query;\n\n    if (error) {\n      logger.error('Failed to fetch ${fileName}s', { filters, error });\n      throw error;\n    }\n\n    return data || [];\n  }\n\n  async create(item: Record<string, unknown>) {\n    const { data, error } = await this.supabase\n      .from('${fileName}s')\n      .insert(item)\n      .select()\n      .single();\n\n    if (error) {\n      logger.error('Failed to create ${fileName}', { item, error });\n      throw error;\n    }\n\n    return data;\n  }\n\n  async update(id: string, updates: Record<string, unknown>) {\n    const { data, error } = await this.supabase\n      .from('${fileName}s')\n      .update(updates)\n      .eq('id', id)\n      .select()\n      .single();\n\n    if (error) {\n      logger.error('Failed to update ${fileName}', { id, updates, error });\n      throw error;\n    }\n\n    return data;\n  }\n\n  async delete(id: string) {\n    const { error } = await this.supabase\n      .from('${fileName}s')\n      .delete()\n      .eq('id', id);\n\n    if (error) {\n      logger.error('Failed to delete ${fileName}', { id, error });\n      throw error;\n    }\n  }\n}\n\nexport const ${className}ServiceInstance = new ${className}Service();`;

    return `${imports}${service}`;
  }

  /**
   * Generate hook
   */
  generateHook(name: string): string {
    const className = this.toPascalCase(name);
    const hookName = `use${className}`;
    const fileName = this.toKebabCase(name);
    const ext = this.config.typescript ? "ts" : "js";

    const imports = this.config.typescript
      ? `import { useState, useEffect } from 'react';\nimport { ${className}ServiceInstance } from '@/lib/services/${fileName}-service';\n`
      : "";

    const hook = `export function ${hookName}(id?: string) {\n  const [data, setData] = useState(null);\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState(null);\n\n  useEffect(() => {\n    async function fetchData() {\n      setLoading(true);\n      setError(null);\n\n      try {\n        const result = id\n          ? await ${className}ServiceInstance.getById(id)\n          : await ${className}ServiceInstance.getAll();\n\n        setData(result);\n      } catch (err) {\n        setError(err instanceof Error ? err.message : 'Unknown error');\n      } finally {\n        setLoading(false);\n      }\n    }\n\n    fetchData();\n  }, [id]);\n\n  return { data, loading, error, refetch: fetchData };\n}`;

    return `${imports}${hook}`;
  }

  /**
   * Generate test file
   */
  generateTest(name: string, type: "api" | "component" | "service"): string {
    const className = this.toPascalCase(name);
    const fileName = this.toKebabCase(name);
    const ext = this.config.typescript ? "ts" : "js";

    let testContent = "";

    switch (type) {
      case "api":
        testContent = `import { describe, it, expect, vi } from 'vitest';\nimport { ${className}Handler } from '../app/api/${fileName}/route';\n\ndescribe('${className} API', () => {\n  it('should handle GET request', async () => {\n    const request = new Request('http://localhost:3000/api/${fileName}', {\n      method: 'GET',\n    });\n\n    const result = await ${className}Handler(request);\n\n    expect(result.success).toBe(true);\n  });\n\n  it('should handle POST request', async () => {\n    const request = new Request('http://localhost:3000/api/${fileName}', {\n      method: 'POST',\n      body: JSON.stringify({ test: 'data' }),\n    });\n\n    const result = await ${className}Handler(request);\n\n    expect(result.success).toBe(true);\n  });\n});`;
        break;

      case "component":
        testContent = `import { describe, it, expect, vi } from 'vitest';\nimport { render, screen } from '@testing-library/react';\nimport ${className} from '../components/${fileName}';\n\ndescribe('${className}', () => {\n  it('should render', () => {\n    render(<${className} />);\n    expect(screen.getByText('${className}')).toBeInTheDocument();\n  });\n});`;
        break;

      case "service":
        testContent = `import { describe, it, expect, beforeEach, vi } from 'vitest';\nimport { ${className}Service } from '../lib/services/${fileName}-service';\n\ndescribe('${className}Service', () => {\n  let service: ${className}Service;\n\n  beforeEach(() => {\n    service = new ${className}Service();\n  });\n\n  it('should get item by id', async () => {\n    const result = await service.getById('test-id');\n    expect(result).toBeDefined();\n  });\n\n  it('should get all items', async () => {\n    const result = await service.getAll();\n    expect(Array.isArray(result)).toBe(true);\n  });\n\n  it('should create item', async () => {\n    const result = await service.create({ name: 'Test' });\n    expect(result).toBeDefined();\n  });\n});`;
        break;
    }

    return testContent;
  }

  /**
   * Write generated file
   */
  writeFile(filePath: string, content: string): void {
    const fullPath = path.join(this.config.outputDir, filePath);
    const dir = path.dirname(fullPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(fullPath, content, "utf-8");
    console.log(`Generated: ${fullPath}`);
  }

  /**
   * Convert to PascalCase
   */
  toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (c) => c.toUpperCase());
  }

  /**
   * Convert to kebab-case
   */
  toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const name = args[1];

  if (!command || !name) {
    console.log("Usage: tsx scripts/code-generator.ts <command> <name>");
    console.log("");
    console.log("Commands:");
    console.log("  api-route      Generate API route");
    console.log("  component       Generate React component");
    console.log("  server-component Generate server React component");
    console.log("  client-component Generate client React component");
    console.log("  service        Generate service class");
    console.log("  hook           Generate React hook");
    console.log("  test-api       Generate API test");
    console.log("  test-component  Generate component test");
    console.log("  test-service   Generate service test");
    process.exit(1);
  }

  const generator = new CodeGenerator({
    outputDir: process.cwd(),
  });

  switch (command) {
    case "api-route":
      generator.writeFile(
        `app/api/${generator.toKebabCase(name)}/route.ts`,
        generator.generateAPIRoute(name)
      );
      break;

    case "component":
      generator.writeFile(
        `components/${generator.toKebabCase(name)}.tsx`,
        generator.generateComponent(name)
      );
      break;

    case "server-component":
      generator.writeFile(
        `components/${generator.toKebabCase(name)}.tsx`,
        generator.generateComponent(name, true)
      );
      break;

    case "client-component":
      generator.writeFile(
        `components/${generator.toKebabCase(name)}.tsx`,
        generator.generateComponent(name, false)
      );
      break;

    case "service":
      generator.writeFile(
        `lib/services/${generator.toKebabCase(name)}-service.ts`,
        generator.generateService(name)
      );
      break;

    case "hook":
      generator.writeFile(
        `hooks/use${generator.toPascalCase(name)}.ts`,
        generator.generateHook(name)
      );
      break;

    case "test-api":
      generator.writeFile(
        `__tests__/api/${generator.toKebabCase(name)}.test.ts`,
        generator.generateTest(name, "api")
      );
      break;

    case "test-component":
      generator.writeFile(
        `__tests__/components/${generator.toKebabCase(name)}.test.tsx`,
        generator.generateTest(name, "component")
      );
      break;

    case "test-service":
      generator.writeFile(
        `__tests__/services/${generator.toKebabCase(name)}-service.test.ts`,
        generator.generateTest(name, "service")
      );
      break;

    default:
      console.log(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Code generation failed:", error);
  process.exit(1);
});

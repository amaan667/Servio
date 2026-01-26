/**
 * Generate OpenAPI specification file
 * Run: tsx scripts/generate-openapi.ts
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { exportOpenAPISpec } from "@/lib/api/openapi-generator";

const outputPath = join(process.cwd(), "public", "openapi.json");

try {
  const spec = exportOpenAPISpec();
  writeFileSync(outputPath, spec, "utf-8");
  // Scripts can use console - this is a CLI tool
  console.log(`✅ OpenAPI specification generated: ${outputPath}`);
} catch (error) {
  // Scripts can use console - this is a CLI tool
  console.error("❌ Failed to generate OpenAPI specification:", error);
  process.exit(1);
}

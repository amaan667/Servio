/**
 * API v1 - OpenAPI Documentation
 * Serves OpenAPI/Swagger specification
 */

import { NextResponse } from "next/server";
import swaggerSpec from "@/docs/swagger.config.js";

export async function GET() {
  try {
    // Generate spec from config
    const spec = await import("@/docs/swagger.config.js");
    return NextResponse.json(spec.default || swaggerSpec, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to generate API docs" }, { status: 500 });
  }
}

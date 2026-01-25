/**
 * OpenAPI/Swagger Documentation Endpoint
 * Serves OpenAPI 3.0 specification for API documentation
 */

import { NextResponse } from "next/server";
import { generateOpenAPISpec } from "@/lib/api/openapi-generator";

export const runtime = "nodejs";

/**
 * GET: Return OpenAPI specification
 */
export async function GET() {
  try {
    const spec = generateOpenAPISpec();
    return NextResponse.json(spec, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate OpenAPI specification",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

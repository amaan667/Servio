/**
 * API v1 - OpenAPI Documentation
 * Serves OpenAPI/Swagger specification
 */

import { NextResponse } from "next/server";
import { swaggerSpec } from "@/lib/swagger/config";

export async function GET() {
  try {
    // Return swagger spec
    return NextResponse.json(swaggerSpec, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to generate API docs" }, { status: 500 });
  }
}

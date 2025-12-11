/**
 * @fileoverview API Documentation endpoint (OpenAPI/Swagger)
 * @module app/api/docs
 */

import { NextResponse } from "next/server";
import { swaggerSpec } from "@/lib/swagger/config";

export async function GET() {
  return NextResponse.json(swaggerSpec);
}

/**
 * Request Validation Middleware
 * Provides consistent Zod-based validation for API requests
 */

import { ZodSchema, ZodError } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { fail, ApiResponse } from "./response-helpers";

export interface ValidationOptions {
  /** Zod schema for request body */

}

/**
 * Validate request body against Zod schema
 */
export async function validateRequest<T>(

): Promise<{ success: true; data: T } | { success: false; response: NextResponse<ApiResponse> }> {
  try {
    let body: unknown;

    // Try to parse JSON body
    try {
      const contentType = req.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        body = await req.json();
      } else {
        body = {};
      }
    } catch {
      body = {};
    }

    // Validate against schema
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return {

        response: fail("Validation failed", 400, {

          })),
        }),
      };
    }

    return {

      response: fail("Invalid request", 400),
    };
  }
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(

): { success: true; data: T } | { success: false; response: NextResponse<ApiResponse> } {
  try {
    const url = new URL(req.url);
    const params: Record<string, string> = {};

    url.searchParams.forEach((value, key) => {
      params[key] = value;

    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return {

        response: fail("Invalid query parameters", 400, {

          })),
        }),
      };
    }

    return {

      response: fail("Invalid query parameters", 400),
    };
  }
}

/**
 * Validate route parameters
 */
export function validateParams<T>(
  params: Record<string, string | undefined>,

): { success: true; data: T } | { success: false; response: NextResponse<ApiResponse> } {
  try {
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return {

        response: fail("Invalid route parameters", 400, {

          })),
        }),
      };
    }

    return {

      response: fail("Invalid route parameters", 400),
    };
  }
}

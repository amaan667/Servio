/**
 * Example Standardized API Route
 * This demonstrates the new universal handler pattern
 *
 * @swagger
 * /api/example-standardized:
 *   get:
 *     summary: Example GET endpoint
 *     tags: [Examples]
 *     parameters:
 *       - in: query
 *         name: venueId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */

import { createGetHandler, createPostHandler } from "@/lib/api/universal-handler";
import { z } from "zod";

// Request validation schema
const querySchema = z.object({
  venueId: z.string().uuid("Invalid venue ID format"),
});

const bodySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

// GET handler example
export const GET = createGetHandler(
  async ({ venueId, user }) => {
    // venueId is validated and available if requireVenueAccess is true
    // user is authenticated if requireAuth is true

    return {
      message: "Success",
      venueId,
      userId: user?.id,
      timestamp: new Date().toISOString(),
    };
  },
  {
    requireAuth: true,
    requireVenueAccess: true,
    venueIdSource: "query",
    logRequest: true,
    logResponse: true,
    trackPerformance: true,
  }
);

// POST handler example
export const POST = createPostHandler<z.infer<typeof bodySchema>>(
  async ({ body, venueId, user }) => {
    // body is already validated against bodySchema

    return {
      success: true,
      created: {
        name: body.name,
        description: body.description,
        venueId,
        createdBy: user?.id,
      },
    };
  },
  {
    schema: bodySchema,
    requireAuth: true,
    requireVenueAccess: true,
    venueIdSource: "auto", // Will try params, query, then body
    logRequest: true,
    logResponse: true,
  }
);

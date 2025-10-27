/**
 * OpenAPI/Swagger Configuration
 * Comprehensive API documentation setup
 */

import swaggerJsdoc from "swagger-jsdoc";
import packageJson from "../../package.json";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Servio API",
      version: packageJson.version || "1.0.0",
      description: `
# Servio API Documentation

Complete REST API for the Servio restaurant management platform.

## Authentication

Most endpoints require authentication via Supabase session cookies or Bearer token.

## Rate Limiting

API requests are rate-limited to prevent abuse. Limits vary by endpoint.

## Error Handling

All errors follow a consistent format:
\`\`\`json
{
  "ok": false,
      "error": "Error message",
      "details": {}
}
\`\`\`

## Status Codes

- \`200\` - Success
- \`400\` - Bad Request (validation error)
- \`401\` - Unauthorized
- \`403\` - Forbidden
- \`404\` - Not Found
- \`429\` - Rate Limited
- \`500\` - Internal Server Error
      `,
      contact: {
        name: "Servio Support",
        email: "support@servio.app",
      },
      license: {
        name: "Proprietary",
      },
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_API_URL || "https://servio-production.up.railway.app",
        description: "Production (Railway)",
      },
      {
        url: "http://localhost:3000",
        description: "Local Development",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Supabase JWT token",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "sb-access-token",
          description: "Supabase session cookie",
        },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["ok", "error"],
          properties: {
            ok: {
              type: "boolean",
              example: false,
            },
            error: {
              type: "string",
              description: "Error message",
            },
            details: {
              type: "object",
              description: "Additional error details",
            },
          },
        },
        Success: {
          type: "object",
          required: ["ok", "data"],
          properties: {
            ok: {
              type: "boolean",
              example: true,
            },
            data: {
              description: "Response data",
            },
          },
        },
        Order: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            venue_id: {
              type: "string",
              format: "uuid",
            },
            order_status: {
              type: "string",
              enum: ["pending", "confirmed", "preparing", "ready", "served", "cancelled"],
            },
            payment_status: {
              type: "string",
              enum: ["pending", "paid", "refunded"],
            },
            total_amount: {
              type: "number",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        MenuItem: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            venue_id: {
              type: "string",
              format: "uuid",
            },
            name: {
              type: "string",
            },
            description: {
              type: "string",
            },
            price: {
              type: "number",
            },
            category: {
              type: "string",
            },
            is_available: {
              type: "boolean",
            },
          },
        },
        Venue: {
          type: "object",
          properties: {
            venue_id: {
              type: "string",
              format: "uuid",
            },
            venue_name: {
              type: "string",
            },
            owner_user_id: {
              type: "string",
              format: "uuid",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: "Authentication required",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                ok: false,
                error: "Unauthorized",
              },
            },
          },
        },
        ForbiddenError: {
          description: "Access denied",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                ok: false,
                error: "Forbidden - access denied to this venue",
              },
            },
          },
        },
        ValidationError: {
          description: "Validation failed",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                ok: false,
                error: "Validation failed",
                details: [
                  {
                    path: "venueId",
                    message: "Required",
                  },
                ],
              },
            },
          },
        },
        ServerError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                ok: false,
                error: "Internal server error",
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
      {
        cookieAuth: [],
      },
    ],
    tags: [
      {
        name: "Orders",
        description: "Order management endpoints",
      },
      {
        name: "Menu",
        description: "Menu and catalog management",
      },
      {
        name: "Tables",
        description: "Table management and QR codes",
      },
      {
        name: "Staff",
        description: "Staff management and invitations",
      },
      {
        name: "Inventory",
        description: "Inventory and stock management",
      },
      {
        name: "Payments",
        description: "Payment processing",
      },
      {
        name: "Dashboard",
        description: "Dashboard and analytics",
      },
      {
        name: "AI Assistant",
        description: "AI-powered features",
      },
    ],
  },
  apis: ["./app/api/**/*.ts", "./lib/api/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);

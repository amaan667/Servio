/**
 * OpenAPI/Swagger Documentation Generator
 * Automatically generates API documentation from route handlers
 */

import { OpenAPIV3 } from "openapi-types";

const baseSpec: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: {
    title: "Servio API",
    version: "0.1.6",
    description: "Production-ready restaurant management platform API",
    contact: {
      name: "Servio Support",
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app",
      description: "Production Server",
    },
    {
      url: "http://localhost:3000",
      description: "Development Server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "sb-access-token",
      },
    },
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            description: "Whether the request was successful",
          },
          data: {
            description: "Response data",
          },
          meta: {
            type: "object",
            properties: {
              requestId: {
                type: "string",
                description: "Correlation ID for request tracking",
              },
              timestamp: {
                type: "string",
                format: "date-time",
              },
              duration: {
                type: "number",
                description: "Request duration in milliseconds",
              },
            },
          },
        },
        required: ["success"],
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          error: {
            type: "string",
            description: "Error message",
          },
          code: {
            type: "string",
            description: "Error code",
          },
          requestId: {
            type: "string",
            description: "Correlation ID for request tracking",
          },
          details: {
            description: "Additional error details",
          },
        },
        required: ["success", "error"],
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          venue_id: { type: "string" },
          customer_name: { type: "string" },
          customer_phone: { type: "string" },
          customer_email: { type: "string", format: "email", nullable: true },
          items: {
            type: "array",
            items: { type: "object" },
          },
          total_amount: { type: "number" },
          order_status: {
            type: "string",
            enum: ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVED", "COMPLETED", "CANCELLED"],
          },
          payment_status: {
            type: "string",
            enum: ["UNPAID", "PAID", "REFUNDED"],
          },
          payment_method: { type: "string" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      MenuItem: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          venue_id: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          price: { type: "number" },
          category: { type: "string" },
          is_available: { type: "boolean" },
        },
      },
    },
    parameters: {
      venueId: {
        name: "venueId",
        in: "path",
        required: true,
        schema: { type: "string" },
        description: "Venue identifier",
      },
      orderId: {
        name: "orderId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Order identifier",
      },
    },
  },
  paths: {},
  tags: [
    { name: "Orders", description: "Order management endpoints" },
    { name: "Menu", description: "Menu management endpoints" },
    { name: "Tables", description: "Table management endpoints" },
    { name: "Payments", description: "Payment processing endpoints" },
    { name: "Staff", description: "Staff management endpoints" },
    { name: "Inventory", description: "Inventory management endpoints" },
    { name: "KDS", description: "Kitchen Display System endpoints" },
    { name: "Reservations", description: "Reservation management endpoints" },
  ],
};

/**
 * Generate OpenAPI spec with route definitions
 */
export function generateOpenAPISpec(): OpenAPIV3.Document {
  const spec = { ...baseSpec };

  // Add common paths
  spec.paths = {
    "/api/orders": {
      get: {
        tags: ["Orders"],
        summary: "Get orders for a venue",
        description: "Retrieve orders with optional filtering",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: "venueId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "status",
            in: "query",
            schema: { type: "string" },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 100 },
          },
        ],
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiResponse",
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedError" },
          "403": { $ref: "#/components/responses/ForbiddenError" },
        },
      },
      post: {
        tags: ["Orders"],
        summary: "Create a new order",
        description: "Public endpoint for customer order creation (QR codes)",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["venue_id", "customer_name", "customer_phone", "items", "total_amount"],
                properties: {
                  venue_id: { type: "string" },
                  customer_name: { type: "string" },
                  customer_phone: { type: "string" },
                  customer_email: { type: "string", format: "email" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        menu_item_id: { type: "string", format: "uuid", nullable: true },
                        item_name: { type: "string" },
                        quantity: { type: "number" },
                        price: { type: "number" },
                      },
                    },
                  },
                  total_amount: { type: "number" },
                  table_number: { type: "string", nullable: true, description: "Table number (string or number)" },
                  payment_method: {
                    type: "string",
                    enum: ["PAY_NOW", "PAY_LATER", "PAY_AT_TILL"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Order created successfully",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            order: { $ref: "#/components/schemas/Order" },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequestError" },
          "429": { $ref: "#/components/responses/RateLimitError" },
        },
      },
    },
    "/api/orders/{orderId}": {
      get: {
        tags: ["Orders"],
        summary: "Get order by ID",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/orderId" }],
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiResponse" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFoundError" },
        },
      },
    },
    "/api/orders/serve": {
      post: {
        tags: ["Orders"],
        summary: "Mark order as served",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId"],
                properties: {
                  orderId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Order marked as served",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiResponse" },
              },
            },
          },
        },
      },
    },
    "/api/menu/{venueId}": {
      get: {
        tags: ["Menu"],
        summary: "Get public menu for venue",
        description: "Public endpoint - no authentication required",
        security: [],
        parameters: [
          { $ref: "#/components/parameters/venueId" },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 200, minimum: 1, maximum: 500 },
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", default: 0, minimum: 0 },
          },
        ],
        responses: {
          "200": {
            description: "Menu data",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            venue: { type: "object" },
                            menuItems: {
                              type: "array",
                              items: { $ref: "#/components/schemas/MenuItem" },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          "429": { $ref: "#/components/responses/RateLimitError" },
        },
      },
    },
  };

  // Add common responses
  spec.components = {
    ...spec.components,
    responses: {
      UnauthorizedError: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
            example: {
              success: false,
              error: "Unauthorized",
              code: "UNAUTHORIZED",
              requestId: "req-123",
            },
          },
        },
      },
      ForbiddenError: {
        description: "Access denied",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      NotFoundError: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      BadRequestError: {
        description: "Invalid request",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      RateLimitError: {
        description: "Rate limit exceeded",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
        headers: {
          "Retry-After": {
            schema: { type: "integer" },
            description: "Seconds to wait before retrying",
          },
        },
      },
    },
  };

  return spec;
}

/**
 * Export OpenAPI spec as JSON
 */
export function exportOpenAPISpec(): string {
  return JSON.stringify(generateOpenAPISpec(), null, 2);
}

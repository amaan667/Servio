import { NextResponse } from "next/server";
import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Servio API",
      version: "1.0.0",
      description: "Comprehensive API documentation for Servio restaurant management platform",
      contact: {
        name: "Servio Support",
        email: "support@servio.com",
      },
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        description: "API Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Order: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            venue_id: { type: "string", format: "uuid" },
            table_id: { type: "string", format: "uuid", nullable: true },
            customer_name: { type: "string" },
            customer_phone: { type: "string" },
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/OrderItem" },
            },
            total_amount: { type: "number", format: "decimal" },
            order_status: {
              type: "string",
              enum: ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING", "COMPLETED", "CANCELLED"],
            },
            payment_status: {
              type: "string",
              enum: ["UNPAID", "PAID", "TILL", "REFUNDED"],
            },
            created_at: { type: "string", format: "date-time" },
          },
        },
        OrderItem: {
          type: "object",
          properties: {
            menu_item_id: { type: "string", format: "uuid", nullable: true },
            quantity: { type: "integer", minimum: 1 },
            price: { type: "number", format: "decimal" },
            item_name: { type: "string" },
            specialInstructions: { type: "string", nullable: true },
          },
        },
        Error: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./app/api/**/*.ts"],
};

export async function GET() {
  try {
    const swaggerSpec = swaggerJsdoc(options);
    return NextResponse.json(swaggerSpec);
  } catch {
    return NextResponse.json({ error: "Failed to generate API documentation" }, { status: 500 });
  }
}

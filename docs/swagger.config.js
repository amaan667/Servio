// Swagger configuration for API documentation

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
        url: "https://servio.com/support",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "https://servio-production.up.railway.app",
        description: "Production server",
      },
      {
        url: "http://localhost:3000",
        description: "Development server",
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
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
            },
            message: {
              type: "string",
              description: "Detailed error description",
            },
            code: {
              type: "string",
              description: "Error code",
            },
          },
        },
        Order: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique order identifier",
            },
            venue_id: {
              type: "string",
              format: "uuid",
              description: "Venue identifier",
            },
            table_id: {
              type: "string",
              format: "uuid",
              description: "Table identifier",
              nullable: true,
            },
            customer_name: {
              type: "string",
              description: "Customer name",
            },
            items: {
              type: "array",
              items: {
                $ref: "#/components/schemas/OrderItem",
              },
            },
            status: {
              type: "string",
              enum: ["pending", "confirmed", "preparing", "ready", "served", "cancelled"],
              description: "Order status",
            },
            total_amount: {
              type: "number",
              format: "decimal",
              description: "Total order amount",
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "Order creation timestamp",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              description: "Last update timestamp",
            },
          },
        },
        OrderItem: {
          type: "object",
          properties: {
            menu_item_id: {
              type: "string",
              format: "uuid",
              description: "Menu item identifier",
            },
            name: {
              type: "string",
              description: "Item name",
            },
            quantity: {
              type: "integer",
              minimum: 1,
              description: "Item quantity",
            },
            price: {
              type: "number",
              format: "decimal",
              description: "Item price",
            },
            notes: {
              type: "string",
              description: "Special instructions",
              nullable: true,
            },
          },
        },
        MenuItem: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Menu item identifier",
            },
            venue_id: {
              type: "string",
              format: "uuid",
              description: "Venue identifier",
            },
            name: {
              type: "string",
              description: "Item name",
            },
            description: {
              type: "string",
              description: "Item description",
            },
            price: {
              type: "number",
              format: "decimal",
              description: "Item price",
            },
            category: {
              type: "string",
              description: "Item category",
            },
            is_available: {
              type: "boolean",
              description: "Availability status",
            },
            image_url: {
              type: "string",
              format: "uri",
              description: "Item image URL",
              nullable: true,
            },
            allergens: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Allergen information",
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "Creation timestamp",
            },
          },
        },
        Table: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Table identifier",
            },
            venue_id: {
              type: "string",
              format: "uuid",
              description: "Venue identifier",
            },
            label: {
              type: "string",
              description: "Table label/number",
            },
            seat_count: {
              type: "integer",
              minimum: 1,
              description: "Number of seats",
            },
            is_active: {
              type: "boolean",
              description: "Table availability",
            },
            qr_version: {
              type: "integer",
              description: "QR code version",
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "Creation timestamp",
            },
          },
        },
        Venue: {
          type: "object",
          properties: {
            venue_id: {
              type: "string",
              format: "uuid",
              description: "Venue identifier",
            },
            venue_name: {
              type: "string",
              description: "Venue name",
            },
            owner_user_id: {
              type: "string",
              format: "uuid",
              description: "Owner user identifier",
            },
            settings: {
              type: "object",
              description: "Venue settings",
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "Creation timestamp",
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
  },
  apis: ["./app/api/**/*.ts", "./lib/**/*.ts"],
};

module.exports = options;

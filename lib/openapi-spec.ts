/**
 * OpenAPI 3.0 specification for Servio API
 * This can be used to generate interactive API documentation
 */

export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Servio API",
    description: "Comprehensive API for restaurant management and QR ordering",
    version: "1.0.0",
    contact: {
      name: "Servio Support",
      email: "api@servio.app",
      url: "https://servio.app/support",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "https://servio.app/api",
      description: "Production server",
    },
    {
      url: "https://staging.servio.app/api",
      description: "Staging server",
    },
  ],
  security: [
    {
      cookieAuth: [],
    },
  ],
  paths: {
    "/venues": {
      get: {
        summary: "Get all venues",
        description: "Retrieve all venues for the authenticated user",
        tags: ["Venues"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "List of venues",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    venues: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/Venue",
                      },
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/orders": {
      get: {
        summary: "Get orders",
        description: "Retrieve orders for a specific venue",
        tags: ["Orders"],
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "venue_id",
            in: "query",
            required: true,
            schema: {
              type: "string",
            },
            description: "Venue ID",
          },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["pending", "preparing", "ready", "completed", "cancelled"],
            },
            description: "Filter by order status",
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              default: 50,
              maximum: 100,
            },
            description: "Number of orders to return",
          },
        ],
        responses: {
          "200": {
            description: "List of orders",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    orders: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/Order",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/menu-items": {
      get: {
        summary: "Get menu items",
        description: "Retrieve menu items for a venue",
        tags: ["Menu"],
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "venue_id",
            in: "query",
            required: true,
            schema: {
              type: "string",
            },
            description: "Venue ID",
          },
          {
            name: "category",
            in: "query",
            schema: {
              type: "string",
            },
            description: "Filter by category",
          },
        ],
        responses: {
          "200": {
            description: "List of menu items",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    menu_items: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/MenuItem",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create menu item",
        description: "Create a new menu item",
        tags: ["Menu"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateMenuItemRequest",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Menu item created",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MenuItem",
                },
              },
            },
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/analytics/revenue": {
      get: {
        summary: "Get revenue analytics",
        description: "Retrieve revenue analytics for a venue",
        tags: ["Analytics"],
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "venue_id",
            in: "query",
            required: true,
            schema: {
              type: "string",
            },
            description: "Venue ID",
          },
          {
            name: "start_date",
            in: "query",
            schema: {
              type: "string",
              format: "date",
            },
            description: "Start date (ISO format)",
          },
          {
            name: "end_date",
            in: "query",
            schema: {
              type: "string",
              format: "date",
            },
            description: "End date (ISO format)",
          },
          {
            name: "group_by",
            in: "query",
            schema: {
              type: "string",
              enum: ["day", "week", "month"],
              default: "day",
            },
            description: "Group results by time period",
          },
        ],
        responses: {
          "200": {
            description: "Revenue analytics",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/RevenueAnalytics",
                },
              },
            },
          },
        },
      },
    },
    "/qr-codes/generate": {
      post: {
        summary: "Generate QR code",
        description: "Generate QR codes for tables or counters",
        tags: ["QR Codes"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/GenerateQRRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "QR code generated",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/QRCode",
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "sb-access-token",
        description: "Session cookie for authentication",
      },
    },
    schemas: {
      Venue: {
        type: "object",
        properties: {
          venue_id: {
            type: "string",
            description: "Unique venue identifier",
          },
          venue_name: {
            type: "string",
            description: "Name of the venue",
          },
          owner_user_id: {
            type: "string",
            description: "ID of the venue owner",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "Creation timestamp",
          },
        },
        required: ["venue_id", "venue_name", "owner_user_id"],
      },
      Order: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "Unique order identifier",
          },
          venue_id: {
            type: "string",
            description: "Venue ID",
          },
          table_number: {
            type: "string",
            description: "Table number",
          },
          status: {
            type: "string",
            enum: ["pending", "preparing", "ready", "completed", "cancelled"],
            description: "Order status",
          },
          total_amount: {
            type: "number",
            format: "float",
            description: "Total order amount",
          },
          items: {
            type: "array",
            items: {
              $ref: "#/components/schemas/OrderItem",
            },
            description: "Order items",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "Order creation timestamp",
          },
        },
        required: ["order_id", "venue_id", "status", "total_amount"],
      },
      OrderItem: {
        type: "object",
        properties: {
          item_name: {
            type: "string",
            description: "Name of the item",
          },
          quantity: {
            type: "integer",
            description: "Quantity ordered",
          },
          price: {
            type: "number",
            format: "float",
            description: "Item price",
          },
        },
        required: ["item_name", "quantity", "price"],
      },
      MenuItem: {
        type: "object",
        properties: {
          item_id: {
            type: "string",
            description: "Unique item identifier",
          },
          venue_id: {
            type: "string",
            description: "Venue ID",
          },
          item_name: {
            type: "string",
            description: "Name of the item",
          },
          description: {
            type: "string",
            description: "Item description",
          },
          price: {
            type: "number",
            format: "float",
            description: "Item price",
          },
          category: {
            type: "string",
            description: "Item category",
          },
          is_available: {
            type: "boolean",
            description: "Whether the item is available",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "Creation timestamp",
          },
        },
        required: ["item_id", "venue_id", "item_name", "price"],
      },
      CreateMenuItemRequest: {
        type: "object",
        properties: {
          venue_id: {
            type: "string",
            description: "Venue ID",
          },
          item_name: {
            type: "string",
            description: "Name of the item",
          },
          description: {
            type: "string",
            description: "Item description",
          },
          price: {
            type: "number",
            format: "float",
            description: "Item price",
          },
          category: {
            type: "string",
            description: "Item category",
          },
          is_available: {
            type: "boolean",
            default: true,
            description: "Whether the item is available",
          },
        },
        required: ["venue_id", "item_name", "price"],
      },
      RevenueAnalytics: {
        type: "object",
        properties: {
          total_revenue: {
            type: "number",
            format: "float",
            description: "Total revenue for the period",
          },
          daily_revenue: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: {
                  type: "string",
                  format: "date",
                },
                revenue: {
                  type: "number",
                  format: "float",
                },
                orders: {
                  type: "integer",
                },
              },
            },
            description: "Daily revenue breakdown",
          },
          top_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item_name: {
                  type: "string",
                },
                revenue: {
                  type: "number",
                  format: "float",
                },
                quantity: {
                  type: "integer",
                },
              },
            },
            description: "Top selling items",
          },
        },
        required: ["total_revenue"],
      },
      GenerateQRRequest: {
        type: "object",
        properties: {
          venue_id: {
            type: "string",
            description: "Venue ID",
          },
          type: {
            type: "string",
            enum: ["table", "counter"],
            description: "QR code type",
          },
          name: {
            type: "string",
            description: "Name of the table or counter",
          },
          size: {
            type: "string",
            enum: ["small", "medium", "large"],
            default: "medium",
            description: "QR code size",
          },
        },
        required: ["venue_id", "type", "name"],
      },
      QRCode: {
        type: "object",
        properties: {
          qr_id: {
            type: "string",
            description: "Unique QR code identifier",
          },
          url: {
            type: "string",
            format: "uri",
            description: "QR code URL",
          },
          type: {
            type: "string",
            enum: ["table", "counter"],
            description: "QR code type",
          },
          name: {
            type: "string",
            description: "Name of the table or counter",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "Creation timestamp",
          },
        },
        required: ["qr_id", "url", "type", "name"],
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "Error message",
          },
          code: {
            type: "string",
            description: "Error code",
          },
          details: {
            type: "string",
            description: "Additional error details",
          },
        },
        required: ["error"],
      },
    },
  },
  tags: [
    {
      name: "Venues",
      description: "Venue management operations",
    },
    {
      name: "Orders",
      description: "Order management operations",
    },
    {
      name: "Menu",
      description: "Menu item management operations",
    },
    {
      name: "Analytics",
      description: "Analytics and reporting operations",
    },
    {
      name: "QR Codes",
      description: "QR code generation operations",
    },
  ],
};

export default openApiSpec;

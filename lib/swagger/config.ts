/**
 * @fileoverview OpenAPI/Swagger configuration
 * @module lib/swagger/config
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Servio API Documentation',
      version: '1.0.0',
      description: 'Complete API documentation for Servio - Modern Restaurant Management Platform',
      contact: {
        name: 'API Support',
        email: 'support@servio.com',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://servio-production.up.railway.app',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Supabase session token',
        },
        CookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'sb-auth-token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type',
            },
            message: {
              type: 'string',
              description: 'Human-readable error message',
            },
            code: {
              type: 'string',
              description: 'Error code',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {},
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
        Order: {
          type: 'object',
          required: ['id', 'venue_id', 'status', 'total_amount'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique order identifier',
            },
            venue_id: {
              type: 'string',
              format: 'uuid',
              description: 'Venue identifier',
            },
            table_number: {
              type: 'string',
              description: 'Table number',
            },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'],
              description: 'Order status',
            },
            items: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/OrderItem',
              },
            },
            total_amount: {
              type: 'number',
              format: 'float',
              description: 'Total order amount',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            menu_item_id: {
              type: 'string',
              format: 'uuid',
            },
            item_name: {
              type: 'string',
            },
            quantity: {
              type: 'integer',
              minimum: 1,
            },
            price: {
              type: 'number',
              format: 'float',
            },
            special_instructions: {
              type: 'string',
            },
          },
        },
        MenuItem: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            price: {
              type: 'number',
              format: 'float',
            },
            category: {
              type: 'string',
            },
            image_url: {
              type: 'string',
              format: 'uri',
            },
            is_available: {
              type: 'boolean',
            },
          },
        },
        Table: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            table_number: {
              type: 'string',
            },
            capacity: {
              type: 'integer',
            },
            status: {
              type: 'string',
              enum: ['available', 'occupied', 'reserved', 'maintenance'],
            },
          },
        },
        Venue: {
          type: 'object',
          properties: {
            venue_id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            address: {
              type: 'string',
            },
            phone: {
              type: 'string',
            },
            email: {
              type: 'string',
              format: 'email',
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Unauthorized',
                message: 'Authentication required',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Access denied',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Forbidden',
                message: 'Access denied to this resource',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Not Found',
                message: 'Resource not found',
              },
            },
          },
        },
        ValidationError: {
          description: 'Invalid request data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  message: { type: 'string' },
                  details: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        field: { type: 'string' },
                        message: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        RateLimitError: {
          description: 'Too many requests',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: 60,
              },
            },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
      {
        CookieAuth: [],
      },
    ],
    tags: [
      {
        name: 'Orders',
        description: 'Order management endpoints',
      },
      {
        name: 'Menu',
        description: 'Menu management endpoints',
      },
      {
        name: 'Tables',
        description: 'Table management endpoints',
      },
      {
        name: 'Inventory',
        description: 'Inventory management endpoints',
      },
      {
        name: 'Staff',
        description: 'Staff management endpoints',
      },
      {
        name: 'Analytics',
        description: 'Analytics and reporting endpoints',
      },
      {
        name: 'Payments',
        description: 'Payment processing endpoints',
      },
      {
        name: 'Auth',
        description: 'Authentication endpoints',
      },
    ],
  },
  apis: ['./app/api/**/*.ts', './lib/swagger/annotations.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);


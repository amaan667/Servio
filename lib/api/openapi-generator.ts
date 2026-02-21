/**
 * OpenAPI/Swagger Documentation Generator
 * Auto-generates API documentation from unified handlers and Zod schemas
 */

// Type definitions for OpenAPI 3.0
interface OpenAPIDocument {
  openapi: string;
  info: {
    title: string;
    description?: string;
    version: string;
    contact?: {
      name?: string;
      email?: string;
      url?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<
      string,
      {
        type: string;
        scheme?: string;
        bearerFormat?: string;
        description?: string;
      }
    >;
  };
}

/**
 * Route metadata for documentation
 */
export interface RouteMetadata {
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  operationId: string;
  summary?: string;
  description?: string;
  tags?: string[];
  authRequired?: boolean;
}

/**
 * Generate basic OpenAPI document from route metadata
 */
export function generateOpenAPIDocument(
  routes: RouteMetadata[],
  options: {
    title: string;
    description?: string;
    version: string;
    baseUrl?: string;
  }
): OpenAPIDocument {
  const { title, description, version, baseUrl = "/api" } = options;

  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    const fullPath = route.path.startsWith("/") ? route.path : `/${route.path}`;

    if (!paths[fullPath]) {
      paths[fullPath] = {};
    }

    const operation: Record<string, unknown> = {
      operationId: route.operationId,
      summary: route.summary,
      description: route.description,
      tags: route.tags,
      responses: {
        "200": { description: "Successful response" },
        "400": { description: "Bad request" },
        "401": { description: "Unauthorized" },
        "403": { description: "Forbidden" },
        "500": { description: "Internal server error" },
      },
    };

    paths[fullPath] = {
      [route.method.toLowerCase()]: operation,
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title,
      description: description || `${title} API Documentation`,
      version,
      contact: {
        name: "Servio API Support",
        email: "api-support@servio.com",
      },
    },
    servers: [{ url: baseUrl, description: "API Base URL" }],
    paths,
    components: {
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string" },
            code: { type: "string" },
            meta: {
              type: "object",
              properties: {
                requestId: { type: "string" },
                timestamp: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT authorization header",
        },
      },
    },
  };
}

/**
 * Create API documentation endpoint
 */
export function createOpenAPIEndpoint(
  routes: RouteMetadata[],
  options: {
    title: string;
    description?: string;
    version: string;
  }
): {
  GET: (req: Request) => Promise<Response>;
} {
  const document = generateOpenAPIDocument(routes, options);

  return {
    GET: async () => {
      return new Response(JSON.stringify(document, null, 2), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
  };
}

/**
 * Generate Swagger UI HTML
 */
export function generateSwaggerUI(openApiJson: OpenAPIDocument): string {
  const spec = JSON.stringify(openApiJson);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui.css">
  <link rel="icon" type="image/png" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/favicon-32x32.png" sizes="32x32">
  <style>
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        spec: ${spec},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        plugins: [SwaggerUIBundle.plugins.DownloadUrl],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;
}

/**
 * Create Swagger UI endpoint
 */
export function createSwaggerUIEndpoint(openApiJson: OpenAPIDocument): {
  GET: (req: Request) => Promise<Response>;
} {
  const html = generateSwaggerUI(openApiJson);

  return {
    GET: async () => {
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    },
  };
}

/**
 * Route registry for auto-documentation
 */
export class OpenAPIRegistry {
  private routes: RouteMetadata[] = [];

  register(route: RouteMetadata): void {
    this.routes.push(route);
  }

  getRoutes(): RouteMetadata[] {
    return this.routes;
  }

  generateDocument(options: {
    title: string;
    description?: string;
    version: string;
    baseUrl?: string;
  }): OpenAPIDocument {
    return generateOpenAPIDocument(this.routes, options);
  }
}

// Export singleton registry
export const openapiRegistry = new OpenAPIRegistry();

/**
 * Generate OpenAPI spec from routes (legacy compatibility)
 */
export function generateOpenAPISpec() {
  return generateOpenAPIDocument([], {
    title: "Servio API",
    description: "Servio Multi-Tenant SaaS Platform API",
    version: "1.0.0",
  });
}

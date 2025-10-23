import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default function APIDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
            Servio API Documentation
          </h1>
          <p className="text-lg text-muted-foreground">
            Comprehensive API documentation for the Servio restaurant management platform
          </p>
        </div>

        <div className="bg-card rounded-lg border p-6">
          <SwaggerUI
            url="/api-docs/swagger.json"
            docExpansion="list"
            defaultModelsExpandDepth={2}
            defaultModelExpandDepth={2}
            tryItOutEnabled={true}
            supportedSubmitMethods={["get", "post", "put", "delete", "patch"]}
            requestInterceptor={(request) => {
              // Add authentication headers
              const token = localStorage.getItem("sb-access-token");
              if (token) {
                request.headers.Authorization = `Bearer ${token}`;
              }
              return request;
            }}
          />
        </div>
      </div>
    </div>
  );
}

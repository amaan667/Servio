'use client';

/**
 * @fileoverview Interactive API documentation UI
 * @module app/api-docs
 */

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function APIDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <h1 className="text-4xl font-bold mb-4">Servio API Documentation</h1>
        <p className="text-muted-foreground mb-8">
          Complete API documentation with interactive testing capabilities
        </p>
        <SwaggerUI url="/api/docs" />
      </div>
    </div>
  );
}


# Distributed Tracing

This document describes the distributed tracing strategy and implementation for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Trace Context Propagation](#trace-context-propagation)
4. [Implementation](#implementation)
5. [Configuration](#configuration)
6. [Analysis and Debugging](#analysis-and-debugging)
7. [Best Practices](#best-practices)

## Overview

Distributed tracing provides end-to-end visibility into requests as they flow through the Servio platform. This enables:

- **Performance Analysis**: Identify bottlenecks and slow operations
- **Error Tracking**: Trace errors across service boundaries
- **Dependency Mapping**: Understand service dependencies
- **Root Cause Analysis**: Quickly identify the source of issues

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Request                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js Application                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Trace ID: abc123                                       │  │
│  │  Span ID: def456                                        │  │
│  │                                                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │  API Route   │  │  Service     │  │  Repository  │ │  │
│  │  │  Span: ghi   │  │  Span: jkl   │  │  Span: mno   │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Database                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Trace ID: abc123                                       │  │
│  │  Span ID: pqr789                                        │  │
│  │                                                          │  │
│  │  ┌──────────────┐  ┌──────────────┐                     │  │
│  │  │  Query 1     │  │  Query 2     │                     │  │
│  │  │  Span: stu   │  │  Span: vwx   │                     │  │
│  │  └──────────────┘  └──────────────┘                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Tracing Backend                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Jaeger / Tempo / Datadog APM                            │  │
│  │                                                          │  │
│  │  - Collect spans                                         │  │
│  │  - Build trace trees                                     │  │
│  │  - Store traces                                          │  │
│  │  - Provide UI for analysis                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Trace Context Propagation

### Trace Context Format

We use the W3C Trace Context standard:

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

Format: `{version}-{trace-id}-{span-id}-{trace-flags}`

- **version**: 00 (current version)
- **trace-id**: 32-character hex string
- **span-id**: 16-character hex string
- **trace-flags**: 2-character hex string (01 = sampled)

### Propagation Headers

```typescript
// Headers to propagate
interface TraceContext {
  traceparent: string;      // W3C trace context
  tracestate?: string;      // Vendor-specific data
  'x-request-id'?: string;  // Request ID
  'x-b3-traceid'?: string;  // B3 format (legacy)
  'x-b3-spanid'?: string;   // B3 format (legacy)
  'x-b3-sampled'?: string;  // B3 format (legacy)
}
```

## Implementation

### Option 1: OpenTelemetry + Jaeger

#### Installation

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations
npm install @opentelemetry/exporter-trace-otlp-grpc @opentelemetry/resource-detector-gcp
```

#### Configuration

```typescript
// lib/tracing/otel.ts
import { trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'servio',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

export const tracer = trace.getTracer('servio');
```

#### Usage in API Routes

```typescript
// app/api/orders/route.ts
import { tracer } from '@/lib/tracing/otel';

export async function POST(request: Request) {
  const span = tracer.startSpan('api.orders.create', {
    attributes: {
      'http.method': 'POST',
      'http.url': request.url,
    },
  });

  try {
    const body = await request.json();

    span.setAttribute('order.userId', body.userId);
    span.setAttribute('order.venueId', body.venueId);

    const order = await createOrder(body, span);

    span.setStatus({ code: 1 }); // OK
    span.end();

    return Response.json(order);
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message }); // ERROR
    span.end();

    return Response.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
```

#### Usage in Services

```typescript
// lib/services/OrderService.ts
import { tracer } from '@/lib/tracing/otel';
import { Span } from '@opentelemetry/api';

export class OrderService {
  async createOrder(data: CreateOrderDto, parentSpan?: Span) {
    const span = tracer.startSpan('OrderService.createOrder', {
      parent: parentSpan,
      attributes: {
        'order.userId': data.userId,
        'order.venueId': data.venueId,
      },
    });

    try {
      // Validate order
      await this.validateOrder(data, span);

      // Create order in database
      const order = await this.orderRepository.create(data, span);

      // Send confirmation
      await this.sendConfirmation(order, span);

      span.setStatus({ code: 1 }); // OK
      span.end();

      return order;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      span.end();
      throw error;
    }
  }

  private async validateOrder(data: CreateOrderDto, parentSpan: Span) {
    const span = tracer.startSpan('OrderService.validateOrder', {
      parent,
      attributes: {
        'order.items': data.items.length,
      },
    });

    try {
      // Validation logic
      const isValid = await this.orderValidator.validate(data);

      span.setAttribute('validation.isValid', isValid);
      span.setStatus({ code: 1 }); // OK
      span.end();

      return isValid;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      span.end();
      throw error;
    }
  }
}
```

#### Usage in Repositories

```typescript
// lib/repositories/order-repository.ts
import { tracer } from '@/lib/tracing/otel';
import { Span } from '@opentelemetry/api';

export class OrderRepository {
  async create(data: CreateOrderDto, parentSpan?: Span) {
    const span = tracer.startSpan('OrderRepository.create', {
      parent,
      attributes: {
        'db.system': 'postgresql',
        'db.name': 'servio',
        'db.operation': 'INSERT',
        'db.table': 'orders',
      },
    });

    try {
      const startTime = Date.now();

      const result = await supabase
        .from('orders')
        .insert(data)
        .select()
        .single();

      const duration = Date.now() - startTime;
      span.setAttribute('db.duration', duration);
      span.setStatus({ code: 1 }); // OK
      span.end();

      return result.data;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      span.end();
      throw error;
    }
  }
}
```

### Option 2: Datadog APM

#### Installation

```bash
npm install dd-trace
```

#### Configuration

```typescript
// lib/tracing/datadog.ts
import tracer from 'dd-trace';

tracer.init({
  service: 'servio',
  env: process.env.NODE_ENV || 'development',
  version: process.env.npm_package_version || '1.0.0',
  logInjection: true,
  analytics: true,
  runtimeMetrics: true,
  experimental: {
    b3: true, // Enable B3 propagation
  },
});

export default tracer;
```

#### Usage

```typescript
// app/api/orders/route.ts
import tracer from '@/lib/tracing/datadog';

export async function POST(request: Request) {
  const span = tracer.startSpan('api.orders.create');

  try {
    const body = await request.json();

    span.setTag('order.userId', body.userId);
    span.setTag('order.venueId', body.venueId);

    const order = await createOrder(body, span);

    span.finish();

    return Response.json(order);
  } catch (error) {
    span.addTags({
      'error.type': error.name,
      'error.message': error.message,
    });
    span.finish();

    return Response.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
```

### Option 3: Custom Tracing

#### Simple Implementation

```typescript
// lib/tracing/custom.ts
import { randomBytes } from 'crypto';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
}

export class Span {
  private startTime: number;
  private children: Span[] = [];

  constructor(
    private name: string,
    private context: TraceContext,
    private parent?: Span
  ) {
    this.startTime = Date.now();
  }

  static createRoot(name: string): Span {
    const traceId = randomBytes(16).toString('hex');
    const spanId = randomBytes(8).toString('hex');

    return new Span(name, {
      traceId,
      spanId,
      sampled: true,
    });
  }

  static fromContext(name: string, context: TraceContext): Span {
    const spanId = randomBytes(8).toString('hex');

    return new Span(name, {
      ...context,
      spanId,
      parentSpanId: context.spanId,
    });
  }

  createChild(name: string): Span {
    const child = Span.fromContext(name, this.context);
    this.children.push(child);
    return child;
  }

  finish(): void {
    const duration = Date.now() - this.startTime;

    // Send to tracing backend
    this.sendSpan({
      name: this.name,
      traceId: this.context.traceId,
      spanId: this.context.spanId,
      parentSpanId: this.context.parentSpanId,
      startTime: this.startTime,
      duration,
      children: this.children.map(c => c.toDTO()),
    });
  }

  private sendSpan(spanData: any): void {
    // Send to your tracing backend
    // This could be Jaeger, Tempo, or a custom solution
    console.log('Span:', JSON.stringify(spanData));
  }

  toDTO(): any {
    return {
      name: this.name,
      traceId: this.context.traceId,
      spanId: this.context.spanId,
      parentSpanId: this.context.parentSpanId,
      startTime: this.startTime,
      duration: Date.now() - this.startTime,
    };
  }

  getContext(): TraceContext {
    return this.context;
  }
}

export function extractTraceContext(headers: Headers): TraceContext | null {
  const traceparent = headers.get('traceparent');
  if (!traceparent) return null;

  const parts = traceparent.split('-');
  if (parts.length !== 4) return null;

  return {
    traceId: parts[1],
    spanId: parts[2],
    sampled: parts[3] === '01',
  };
}

export function injectTraceContext(context: TraceContext): Headers {
  const headers = new Headers();
  headers.set('traceparent', `00-${context.traceId}-${context.spanId}-01`);
  return headers;
}
```

#### Usage

```typescript
// app/api/orders/route.ts
import { Span, extractTraceContext } from '@/lib/tracing/custom';

export async function POST(request: Request) {
  const traceContext = extractTraceContext(request.headers);
  const span = traceContext
    ? Span.fromContext('api.orders.create', traceContext)
    : Span.createRoot('api.orders.create');

  try {
    const body = await request.json();

    const order = await createOrder(body, span);

    span.finish();

    return Response.json(order, {
      headers: injectTraceContext(span.getContext()),
    });
  } catch (error) {
    span.finish();

    return Response.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
```

## Configuration

### Environment Variables

```bash
# OpenTelemetry
OTEL_SERVICE_NAME=servio
OTEL_SERVICE_VERSION=1.0.0
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1

# Datadog
DD_TRACE_ENABLED=true
DD_TRACE_SERVICE_NAME=servio
DD_TRACE_ENV=production
DD_TRACE_VERSION=1.0.0
DD_TRACE_AGENT_URL=http://localhost:8126
DD_TRACE_ANALYTICS_ENABLED=true
DD_TRACE_RUNTIME_METRICS_ENABLED=true

# Custom Tracing
TRACE_ENABLED=true
TRACE_SAMPLE_RATE=0.1
TRACE_BACKEND=jaeger
TRACE_JAEGER_ENDPOINT=http://localhost:14268/api/traces
```

### Jaeger Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "5775:5775/udp"
      - "6831:6831/udp"
      - "6832:6832/udp"
      - "5778:5778"
      - "16686:16686"
      - "14268:14268"
      - "14250:14250"
      - "9411:9411"
    environment:
      - COLLECTOR_ZIPKIN_HOST_PORT=:9411
      - COLLECTOR_OTLP_ENABLED=true
```

### Tempo Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  tempo:
    image: grafana/tempo:latest
    command: ["-config.file=/etc/tempo.yaml"]
    volumes:
      - ./tempo.yaml:/etc/tempo.yaml
      - tempo_data:/tmp/tempo
    ports:
      - "3100:3100"
      - "4317:4317"
      - "4318:4318"

volumes:
  tempo_data:
```

```yaml
# tempo.yaml
server:
  http_listen_port: 3100

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo
```

## Analysis and Debugging

### Jaeger UI

1. **Search Traces**: Filter by service, operation, tags, and time range
2. **View Trace Details**: See the complete trace tree with timing
3. **Analyze Spans**: Examine individual spans with attributes and logs
4. **Compare Traces**: Compare multiple traces to identify patterns

### Tempo UI

1. **Query Traces**: Use TempoQL to search for traces
2. **Visualize Traces**: See trace waterfall diagrams
3. **Analyze Performance**: Identify slow operations and bottlenecks

### Datadog APM

1. **Service Map**: Visualize service dependencies
2. **Trace Search**: Filter by service, resource, error, and tags
3. **Flame Graphs**: See detailed performance breakdowns
4. **Error Tracking**: Identify and analyze errors across traces

## Best Practices

### 1. Span Naming

Use descriptive, consistent span names:

```typescript
// Good
tracer.startSpan('OrderService.createOrder');
tracer.startSpan('OrderRepository.create');
tracer.startSpan('PaymentService.processPayment');

// Bad
tracer.startSpan('create');
tracer.startSpan('doWork');
tracer.startSpan('handle');
```

### 2. Span Attributes

Add relevant attributes to spans:

```typescript
span.setAttribute('http.method', 'POST');
span.setAttribute('http.url', '/api/orders');
span.setAttribute('http.status_code', 200);
span.setAttribute('order.id', '123');
span.setAttribute('order.userId', '456');
span.setAttribute('order.venueId', '789');
```

### 3. Span Events

Add events to spans for important moments:

```typescript
span.addEvent('order.created', {
  orderId: '123',
  timestamp: Date.now(),
});

span.addEvent('payment.processed', {
  paymentId: '456',
  amount: 100,
});
```

### 4. Error Handling

Record errors in spans:

```typescript
try {
  await createOrder(data);
} catch (error) {
  span.recordException(error);
  span.setStatus({
    code: 2, // ERROR
    message: error.message,
  });
  throw error;
}
```

### 5. Sampling

Use appropriate sampling rates:

```typescript
// Development: Sample all traces
OTEL_TRACES_SAMPLER=always_on

// Staging: Sample 50% of traces
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=0.5

// Production: Sample 10% of traces
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1
```

### 6. Context Propagation

Always propagate trace context:

```typescript
// API to Service
const order = await orderService.createOrder(data, span);

// Service to Repository
const result = await orderRepository.create(data, span);

// Service to External API
const response = await fetch('https://api.example.com', {
  headers: injectTraceContext(span.getContext()),
});
```

### 7. Performance Impact

Minimize performance impact:

```typescript
// Use async span sending
span.finish(); // Non-blocking

// Batch span exports
OTEL_BSP_EXPORT_TIMEOUT=5000

// Use efficient serialization
OTEL_EXPORTER_OTLP_COMPRESSION=gzip
```

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Grafana Tempo](https://grafana.com/docs/tempo/latest/)
- [Datadog APM](https://docs.datadoghq.com/tracing/)

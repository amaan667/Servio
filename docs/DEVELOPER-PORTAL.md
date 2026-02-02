# Developer Portal

This document describes the developer portal for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Implementation](#implementation)
5. [Best Practices](#best-practices)

## Overview

The developer portal provides a centralized hub for developers to access documentation, tools, and resources for building on the Servio platform. It includes:

- **API Documentation**: Complete API reference with examples
- **SDKs and Libraries**: Official SDKs for popular languages
- **Code Samples**: Ready-to-use code examples
- **Interactive API Explorer**: Test API endpoints directly
- **Webhook Playground**: Test webhook integrations
- **Authentication**: Manage API keys and OAuth applications
- **Support**: Access to support resources and community

## Features

### API Documentation

```typescript
// app/developer/api/page.tsx
export default function APIDocumentationPage() {
  return (
    <div className="api-documentation">
      <h1>API Documentation</h1>

      <div className="api-nav">
        <APISectionNav
          sections={[
            { id: 'overview', label: 'Overview' },
            { id: 'authentication', label: 'Authentication' },
            { id: 'venues', label: 'Venues' },
            { id: 'menus', label: 'Menus' },
            { id: 'orders', label: 'Orders' },
            { id: 'tables', label: 'Tables' },
            { id: 'staff', label: 'Staff' },
            { id: 'inventory', label: 'Inventory' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'webhooks', label: 'Webhooks' },
          ]}
        />
      </div>

      <div className="api-content">
        <APIOverview />
        <APIAuthentication />
        <APIEndpoints />
        <APIExamples />
        <APIErrorCodes />
      </div>
    </div>
  );
}
```

### Interactive API Explorer

```typescript
// app/developer/api/explorer/page.tsx
export default function APIExplorerPage() {
  const [endpoint, setEndpoint] = useState('/api/v1/venues');
  const [method, setMethod] = useState('GET');
  const [params, setParams] = useState({});
  const [response, setResponse] = useState(null);

  async function executeRequest() {
    const res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getApiKey()}`,
      },
      body: method !== 'GET' ? JSON.stringify(params) : undefined,
    });

    const data = await res.json();
    setResponse(data);
  }

  return (
    <div className="api-explorer">
      <h1>API Explorer</h1>

      <div className="request-builder">
        <MethodSelector value={method} onChange={setMethod} />
        <EndpointInput value={endpoint} onChange={setEndpoint} />
        <ParamsEditor value={params} onChange={setParams} />
        <Button onClick={executeRequest}>Send Request</Button>
      </div>

      <div className="response-viewer">
        <ResponseViewer response={response} />
      </div>
    </div>
  );
}
```

### SDK Documentation

```typescript
// app/developer/sdks/page.tsx
export default function SDKsPage() {
  return (
    <div className="sdks-page">
      <h1>SDKs and Libraries</h1>

      <div className="sdk-grid">
        <SDKCard
          name="JavaScript/TypeScript"
          version="1.0.0"
          description="Official SDK for JavaScript and TypeScript"
          install="npm install @servio/sdk"
          docs="/developer/sdks/javascript"
        />
        <SDKCard
          name="Python"
          version="1.0.0"
          description="Official SDK for Python"
          install="pip install servio-sdk"
          docs="/developer/sdks/python"
        />
        <SDKCard
          name="Ruby"
          version="1.0.0"
          description="Official SDK for Ruby"
          install="gem install servio-sdk"
          docs="/developer/sdks/ruby"
        />
        <SDKCard
          name="Go"
          version="1.0.0"
          description="Official SDK for Go"
          install="go get github.com/servio/sdk-go"
          docs="/developer/sdks/go"
        />
      </div>
    </div>
  );
}
```

### Code Samples

```typescript
// app/developer/samples/page.tsx
export default function CodeSamplesPage() {
  return (
    <div className="code-samples-page">
      <h1>Code Samples</h1>

      <div className="samples-nav">
        <CategoryNav
          categories={[
            { id: 'authentication', label: 'Authentication' },
            { id: 'venues', label: 'Venues' },
            { id: 'menus', label: 'Menus' },
            { id: 'orders', label: 'Orders' },
            { id: 'webhooks', label: 'Webhooks' },
          ]}
        />
      </div>

      <div className="samples-grid">
        <CodeSample
          title="Create a Venue"
          description="Learn how to create a new venue"
          language="typescript"
          code={createVenueSample}
        />
        <CodeSample
          title="Create a Menu"
          description="Learn how to create a new menu"
          language="typescript"
          code={createMenuSample}
        />
        <CodeSample
          title="Create an Order"
          description="Learn how to create a new order"
          language="typescript"
          code={createOrderSample}
        />
        <CodeSample
          title="Handle Webhooks"
          description="Learn how to handle webhook events"
          language="typescript"
          code={handleWebhookSample}
        />
      </div>
    </div>
  );
}
```

### Webhook Playground

```typescript
// app/developer/webhooks/playground/page.tsx
export default function WebhookPlaygroundPage() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  async function sendTestWebhook() {
    const res = await fetch('/api/developer/webhooks/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        event: selectedEvent,
      }),
    });

    const data = await res.json();
    return data;
  }

  return (
    <div className="webhook-playground">
      <h1>Webhook Playground</h1>

      <div className="webhook-config">
        <FormField
          label="Webhook URL"
          type="url"
          value={webhookUrl}
          onChange={setWebhookUrl}
        />
        <EventSelector
          events={events}
          selected={selectedEvent}
          onChange={setSelectedEvent}
        />
        <Button onClick={sendTestWebhook}>Send Test Webhook</Button>
      </div>

      <div className="webhook-response">
        <ResponseViewer response={webhookResponse} />
      </div>
    </div>
  );
}
```

### API Keys Management

```typescript
// app/developer/keys/page.tsx
export default function APIKeysPage() {
  const [keys, setKeys] = useState([]);

  async function createKey() {
    const res = await fetch('/api/developer/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My API Key',
        scopes: ['venues:read', 'orders:write'],
      }),
    });

    const data = await res.json();
    setKeys([...keys, data]);
  }

  async function revokeKey(id: string) {
    await fetch(`/api/developer/keys/${id}`, {
      method: 'DELETE',
    });

    setKeys(keys.filter(k => k.id !== id));
  }

  return (
    <div className="api-keys-page">
      <h1>API Keys</h1>

      <div className="actions-bar">
        <Button onClick={createKey}>Create API Key</Button>
      </div>

      <Table
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'key', label: 'Key' },
          { key: 'scopes', label: 'Scopes' },
          { key: 'createdAt', label: 'Created' },
          { key: 'lastUsed', label: 'Last Used' },
          { key: 'actions', label: 'Actions' },
        ]}
        data={keys}
        actions={(key) => (
          <>
            <Button onClick={() => copyKey(key.key)}>Copy</Button>
            <Button onClick={() => revokeKey(key.id)} variant="danger">
              Revoke
            </Button>
          </>
        )}
      />
    </div>
  );
}
```

### OAuth Applications

```typescript
// app/developer/oauth/page.tsx
export default function OAuthApplicationsPage() {
  const [apps, setApps] = useState([]);

  async function createApp() {
    const res = await fetch('/api/developer/oauth/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My App',
        redirectUris: ['https://example.com/callback'],
        scopes: ['venues:read', 'orders:write'],
      }),
    });

    const data = await res.json();
    setApps([...apps, data]);
  }

  return (
    <div className="oauth-applications-page">
      <h1>OAuth Applications</h1>

      <div className="actions-bar">
        <Button onClick={createApp}>Create Application</Button>
      </div>

      <Table
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'clientId', label: 'Client ID' },
          { key: 'redirectUris', label: 'Redirect URIs' },
          { key: 'scopes', label: 'Scopes' },
          { key: 'createdAt', label: 'Created' },
          { key: 'actions', label: 'Actions' },
        ]}
        data={apps}
        actions={(app) => (
          <>
            <Button onClick={() => viewApp(app.id)}>View</Button>
            <Button onClick={() => editApp(app.id)}>Edit</Button>
            <Button onClick={() => deleteApp(app.id)} variant="danger">
              Delete
            </Button>
          </>
        )}
      />
    </div>
  );
}
```

### Support

```typescript
// app/developer/support/page.tsx
export default function SupportPage() {
  return (
    <div className="support-page">
      <h1>Support</h1>

      <div className="support-grid">
        <SupportCard
          title="Documentation"
          description="Comprehensive documentation for all features"
          icon={<DocumentationIcon />}
          link="/developer/docs"
        />
        <SupportCard
          title="API Reference"
          description="Complete API reference with examples"
          icon={<APIIcon />}
          link="/developer/api"
        />
        <SupportCard
          title="Community Forum"
          description="Join our community to ask questions"
          icon={<CommunityIcon />}
          link="https://community.servio.com"
        />
        <SupportCard
          title="Contact Support"
          description="Get help from our support team"
          icon={<SupportIcon />}
          link="/developer/support/contact"
        />
      </div>

      <div className="faq-section">
        <h2>Frequently Asked Questions</h2>
        <FAQAccordion
          faqs={[
            {
              question: 'How do I get started with the API?',
              answer: 'To get started, create an API key in the developer portal and use it to authenticate your requests.',
            },
            {
              question: 'What are the rate limits?',
              answer: 'The API has a rate limit of 1000 requests per minute per API key.',
            },
            {
              question: 'How do I handle webhooks?',
              answer: 'Webhooks are sent to your registered endpoint when events occur. You can verify the signature to ensure the webhook is from Servio.',
            },
          ]}
        />
      </div>
    </div>
  );
}
```

## Architecture

### Component Structure

```
app/developer/
├── page.tsx                    # Developer portal home
├── api/
│   ├── page.tsx              # API documentation
│   ├── explorer/
│   │   └── page.tsx          # API explorer
│   └── reference/
│       └── page.tsx          # API reference
├── sdks/
│   ├── page.tsx              # SDKs overview
│   ├── javascript/
│   │   └── page.tsx          # JavaScript SDK docs
│   ├── python/
│   │   └── page.tsx          # Python SDK docs
│   ├── ruby/
│   │   └── page.tsx          # Ruby SDK docs
│   └── go/
│       └── page.tsx          # Go SDK docs
├── samples/
│   ├── page.tsx              # Code samples
│   ├── authentication/
│   │   └── page.tsx          # Authentication samples
│   ├── venues/
│   │   └── page.tsx          # Venue samples
│   ├── menus/
│   │   └── page.tsx          # Menu samples
│   └── orders/
│       └── page.tsx          # Order samples
├── webhooks/
│   ├── page.tsx              # Webhook documentation
│   ├── playground/
│   │   └── page.tsx          # Webhook playground
│   └── events/
│       └── page.tsx          # Webhook events
├── keys/
│   └── page.tsx              # API keys management
├── oauth/
│   ├── page.tsx              # OAuth applications
│   └── apps/
│       └── [id]/
│           └── page.tsx      # OAuth app details
└── support/
    ├── page.tsx              # Support page
    ├── contact/
    │   └── page.tsx          # Contact form
    └── faq/
        └── page.tsx          # FAQ
```

### API Routes

```typescript
// app/api/developer/keys/route.ts
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await requireAuth(request);

  const keys = await getAPIKeys(session.user.id);

  return Response.json({ data: keys });
}

export async function POST(request: Request) {
  const session = await requireAuth(request);

  const body = await request.json();
  const key = await createAPIKey({
    userId: session.user.id,
    name: body.name,
    scopes: body.scopes,
  });

  return Response.json({ data: key }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(request);

  await revokeAPIKey(params.id, session.user.id);

  return Response.json({ success: true });
}
```

## Best Practices

### 1. Use Server Components

Use server components for better performance:

```typescript
// Good: Server component
export default async function APIReferencePage() {
  const endpoints = await getAPIEndpoints();

  return (
    <div>
      <APIEndpointsList endpoints={endpoints} />
    </div>
  );
}

// Bad: Client component with data fetching
export default function APIReferencePage() {
  const [endpoints, setEndpoints] = useState([]);

  useEffect(() => {
    fetchAPIEndpoints().then(setEndpoints);
  }, []);

  return (
    <div>
      <APIEndpointsList endpoints={endpoints} />
    </div>
  );
}
```

### 2. Provide Clear Examples

Provide clear, copy-pasteable examples:

```typescript
// Good: Clear example with comments
```typescript
import { ServioClient } from '@servio/sdk';

const client = new ServioClient({
  apiKey: 'your-api-key',
});

// Create a new venue
const venue = await client.venues.create({
  name: 'My Restaurant',
  address: '123 Main St',
  city: 'San Francisco',
  state: 'CA',
  zip: '94102',
});

console.log('Venue created:', venue);
```

// Bad: Unclear example
```typescript
const venue = await createVenue({ name: 'My Restaurant' });
```
```

### 3. Include Error Handling

Include error handling in examples:

```typescript
// Good: With error handling
```typescript
try {
  const venue = await client.venues.create(data);
  console.log('Venue created:', venue);
} catch (error) {
  if (error instanceof ServioError) {
    console.error('API Error:', error.message);
    console.error('Status:', error.status);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

// Bad: No error handling
```typescript
const venue = await client.venues.create(data);
console.log('Venue created:', venue);
```
```

### 4. Use Interactive Examples

Use interactive examples where possible:

```typescript
// Good: Interactive example
<CodeExample
  title="Create a Venue"
  language="typescript"
  code={createVenueExample}
  editable={true}
  onRun={handleRun}
/>

// Bad: Static code block
```typescript
const venue = await client.venues.create(data);
```
```

### 5. Provide Multiple Languages

Provide examples in multiple languages:

```typescript
// Good: Multiple languages
<CodeTabs
  tabs={[
    { label: 'TypeScript', code: typescriptExample },
    { label: 'Python', code: pythonExample },
    { label: 'Ruby', code: rubyExample },
  ]}
/>

// Bad: Single language
```typescript
const venue = await client.venues.create(data);
```
```

### 6. Include Testing Tools

Include testing tools for developers:

```typescript
// Good: Testing tools
<WebhookPlayground />
<APIExplorer />
<SDKTester />

// Bad: No testing tools
<p>Use the API to create webhooks.</p>
```

### 7. Provide Quick Start Guide

Provide a quick start guide:

```typescript
// Good: Quick start guide
<QuickStartGuide
  steps={[
    {
      title: 'Create an API Key',
      description: 'Go to the API Keys page and create a new API key.',
    },
    {
      title: 'Install the SDK',
      description: 'Install the SDK using npm: npm install @servio/sdk',
    },
    {
      title: 'Make Your First Request',
      description: 'Use the SDK to make your first API request.',
    },
  ]}
/>

// Bad: No quick start guide
<p>Read the documentation to get started.</p>
```

## References

- [Developer Portal Best Practices](https://www.smashingmagazine.com/2022/01/developer-portal-best-practices/)
- [API Documentation Tools](https://www.nngroup.com/articles/api-documentation-tools/)
- [Developer Experience](https://www.nngroup.com/articles/developer-experience/)
- [API Design](https://www.nngroup.com/articles/api-design/)

# Admin Panel for Platform Management

This document describes the admin panel for managing the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Implementation](#implementation)
5. [Security](#security)
6. [Best Practices](#best-practices)

## Overview

The admin panel provides a centralized interface for managing the Servio platform. It allows administrators to:

- **Manage Users**: View, create, update, and delete users
- **Manage Venues**: Monitor and manage venue accounts
- **Monitor Performance**: View system metrics and performance
- **Manage Features**: Configure feature flags and A/B tests
- **View Analytics**: Access business metrics and analytics
- **Manage Billing**: View and manage subscriptions and payments
- **Configure Settings**: Manage platform-wide settings

## Features

### Dashboard

```typescript
// app/admin/page.tsx
export default function AdminDashboard() {
  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>

      <div className="stats-grid">
        <StatCard
          title="Total Users"
          value={1234}
          change="+12%"
          icon={<UsersIcon />}
        />
        <StatCard
          title="Active Venues"
          value={456}
          change="+5%"
          icon={<VenueIcon />}
        />
        <StatCard
          title="Total Orders Today"
          value={7890}
          change="+15%"
          icon={<OrderIcon />}
        />
        <StatCard
          title="Revenue Today"
          value="$12,345"
          change="+8%"
          icon={<DollarIcon />}
        />
      </div>

      <div className="charts-grid">
        <ChartCard
          title="User Growth"
          type="line"
          data={userGrowthData}
        />
        <ChartCard
          title="Order Volume"
          type="bar"
          data={orderVolumeData}
        />
        <ChartCard
          title="Revenue Trend"
          type="area"
          data={revenueTrendData}
        />
      </div>
    </div>
  );
}
```

### User Management

```typescript
// app/admin/users/page.tsx
export default function UsersPage() {
  return (
    <div className="users-page">
      <h1>User Management</h1>

      <div className="actions-bar">
        <Button onClick={createUser}>Add User</Button>
        <Button onClick={exportUsers}>Export CSV</Button>
        <SearchInput placeholder="Search users..." />
      </div>

      <Table
        columns={[
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role' },
          { key: 'venueId', label: 'Venue' },
          { key: 'status', label: 'Status' },
          { key: 'createdAt', label: 'Created' },
          { key: 'actions', label: 'Actions' },
        ]}
        data={users}
        onRowClick={viewUser}
        actions={(user) => (
          <>
            <Button onClick={() => editUser(user.id)}>Edit</Button>
            <Button onClick={() => deleteUser(user.id)} variant="danger">
              Delete
            </Button>
          </>
        )}
      />
    </div>
  );
}
```

### Venue Management

```typescript
// app/admin/venues/page.tsx
export default function VenuesPage() {
  return (
    <div className="venues-page">
      <h1>Venue Management</h1>

      <div className="actions-bar">
        <Button onClick={createVenue}>Add Venue</Button>
        <Button onClick={exportVenues}>Export CSV</Button>
        <SearchInput placeholder="Search venues..." />
      </div>

      <Table
        columns={[
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'address', label: 'Address' },
          { key: 'ownerId', label: 'Owner' },
          { key: 'status', label: 'Status' },
          { key: 'subscriptionTier', label: 'Subscription' },
          { key: 'ordersToday', label: 'Orders Today' },
          { key: 'revenueMonth', label: 'Revenue (Month)' },
          { key: 'actions', label: 'Actions' },
        ]}
        data={venues}
        onRowClick={viewVenue}
        actions={(venue) => (
          <>
            <Button onClick={() => editVenue(venue.id)}>Edit</Button>
            <Button onClick={() => viewOrders(venue.id)}>Orders</Button>
            <Button onClick={() => viewAnalytics(venue.id)}>Analytics</Button>
            <Button onClick={() => deleteVenue(venue.id)} variant="danger">
              Delete
            </Button>
          </>
        )}
      />
    </div>
  );
}
```

### Feature Flags

```typescript
// app/admin/feature-flags/page.tsx
export default function FeatureFlagsPage() {
  return (
    <div className="feature-flags-page">
      <h1>Feature Flags</h1>

      <div className="actions-bar">
        <Button onClick={createFeatureFlag}>Create Feature Flag</Button>
        <Button onClick={syncFlags}>Sync with LaunchDarkly</Button>
      </div>

      <Table
        columns={[
          { key: 'key', label: 'Key' },
          { key: 'name', label: 'Name' },
          { key: 'description', label: 'Description' },
          { key: 'type', label: 'Type' },
          { key: 'enabled', label: 'Enabled' },
          { key: 'allocation', label: 'Allocation' },
          { key: 'actions', label: 'Actions' },
        ]}
        data={featureFlags}
        onRowClick={viewFeatureFlag}
        actions={(flag) => (
          <>
            <Button onClick={() => toggleFlag(flag.id)}>
              {flag.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button onClick={() => editFlag(flag.id)}>Edit</Button>
            <Button onClick={() => viewVariants(flag.id)}>Variants</Button>
            <Button onClick={() => deleteFlag(flag.id)} variant="danger">
              Delete
            </Button>
          </>
        )}
      />
    </div>
  );
}
```

### A/B Testing

```typescript
// app/admin/ab-testing/page.tsx
export default function ABTestingPage() {
  return (
    <div className="ab-testing-page">
      <h1>A/B Testing</h1>

      <div className="actions-bar">
        <Button onClick={createExperiment}>Create Experiment</Button>
        <Button onClick={syncExperiments}>Sync with Optimizely</Button>
      </div>

      <Table
        columns={[
          { key: 'key', label: 'Key' },
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status' },
          { key: 'startDate', label: 'Start Date' },
          { key: 'endDate', label: 'End Date' },
          { key: 'controlConversion', label: 'Control Conversion' },
          { key: 'variantConversion', label: 'Variant Conversion' },
          { key: 'improvement', label: 'Improvement' },
          { key: 'significance', label: 'Significance' },
          { key: 'actions', label: 'Actions' },
        ]}
        data={experiments}
        onRowClick={viewExperiment}
        actions={(experiment) => (
          <>
            <Button onClick={() => viewResults(experiment.id)}>Results</Button>
            <Button onClick={() => pauseExperiment(experiment.id)}>
              Pause
            </Button>
            <Button onClick={() => resumeExperiment(experiment.id)}>
              Resume
            </Button>
            <Button onClick={() => stopExperiment(experiment.id)} variant="danger">
              Stop
            </Button>
          </>
        )}
      />
    </div>
  );
}
```

### Analytics

```typescript
// app/admin/analytics/page.tsx
export default function AnalyticsPage() {
  return (
    <div className="analytics-page">
      <h1>Analytics</h1>

      <div className="date-range-selector">
        <DateRangeSelector onChange={setDateRange} />
      </div>

      <div className="metrics-grid">
        <MetricCard
          title="Total Revenue"
          value="$123,456"
          change="+12%"
          chart={revenueChart}
        />
        <MetricCard
          title="Total Orders"
          value={45678}
          change="+8%"
          chart={ordersChart}
        />
        <MetricCard
          title="Active Users"
          value={1234}
          change="+5%"
          chart={usersChart}
        />
        <MetricCard
          title="Average Order Value"
          value="$27.50"
          change="+3%"
          chart={aovChart}
        />
      </div>

      <div className="breakdown-section">
        <h2>Revenue by Venue</h2>
        <BarChart data={venueRevenueData} />

        <h2>Orders by Category</h2>
        <PieChart data={categoryOrdersData} />

        <h2>Top Menu Items</h2>
        <Table data={topMenuItemsData} />
      </div>
    </div>
  );
}
```

### Billing

```typescript
// app/admin/billing/page.tsx
export default function BillingPage() {
  return (
    <div className="billing-page">
      <h1>Billing</h1>

      <div className="billing-summary">
        <Card title="Current Plan">
          <div className="plan-details">
            <h3>Enterprise</h3>
            <p>$999/month</p>
            <ul>
              <li>Unlimited venues</li>
              <li>Unlimited users</li>
              <li>Priority support</li>
              <li>Custom integrations</li>
            </ul>
          </div>
          <Button onClick={upgradePlan}>Upgrade Plan</Button>
        </Card>

        <Card title="Usage This Month">
          <div className="usage-details">
            <Stat label="Venues" value={456} />
            <Stat label="Users" value={1234} />
            <Stat label="Orders" value={45678} />
            <Stat label="API Calls" value={123456} />
          </div>
        </Card>

        <Card title="Next Invoice">
          <div className="invoice-details">
            <p>Amount: <strong>$999.00</strong></p>
            <p>Due: <strong>2024-02-15</strong></p>
            <Button onClick={viewInvoice}>View Invoice</Button>
          </div>
        </Card>
      </div>

      <div className="billing-history">
        <h2>Billing History</h2>
        <Table
          columns={[
            { key: 'id', label: 'Invoice ID' },
            { key: 'date', label: 'Date' },
            { key: 'amount', label: 'Amount' },
            { key: 'status', label: 'Status' },
            { key: 'actions', label: 'Actions' },
          ]}
          data={invoices}
          actions={(invoice) => (
            <Button onClick={() => downloadInvoice(invoice.id)}>Download</Button>
          )}
        />
      </div>
    </div>
  );
}
```

### Settings

```typescript
// app/admin/settings/page.tsx
export default function SettingsPage() {
  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <Tabs>
        <Tab label="General">
          <div className="settings-section">
            <h2>General Settings</h2>
            <FormField
              label="Platform Name"
              type="text"
              value={settings.platformName}
              onChange={updateSettings}
            />
            <FormField
              label="Support Email"
              type="email"
              value={settings.supportEmail}
              onChange={updateSettings}
            />
            <FormField
              label="Default Currency"
              type="select"
              value={settings.defaultCurrency}
              onChange={updateSettings}
              options={currencyOptions}
            />
            <Button onClick={saveSettings}>Save Settings</Button>
          </div>
        </Tab>

        <Tab label="Security">
          <div className="settings-section">
            <h2>Security Settings</h2>
            <FormField
              label="Session Timeout (minutes)"
              type="number"
              value={settings.sessionTimeout}
              onChange={updateSettings}
            />
            <FormField
              label="Max Login Attempts"
              type="number"
              value={settings.maxLoginAttempts}
              onChange={updateSettings}
            />
            <FormField
              label="Password Requirements"
              type="checkbox"
              label="Require 2FA for Admins"
              checked={settings.require2FAForAdmins}
              onChange={updateSettings}
            />
            <Button onClick={saveSettings}>Save Settings</Button>
          </div>
        </Tab>

        <Tab label="Integrations">
          <div className="settings-section">
            <h2>Integrations</h2>
            <IntegrationCard
              name="Stripe"
              status="Connected"
              config={stripeConfig}
            />
            <IntegrationCard
              name="Supabase"
              status="Connected"
              config={supabaseConfig}
            />
            <IntegrationCard
              name="LaunchDarkly"
              status="Connected"
              config={launchdarklyConfig}
            />
            <Button onClick={addIntegration}>Add Integration</Button>
          </div>
        </Tab>

        <Tab label="Notifications">
          <div className="settings-section">
            <h2>Notification Settings</h2>
            <FormField
              label="Email Notifications"
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={updateSettings}
            />
            <FormField
              label="Slack Webhook"
              type="text"
              value={settings.slackWebhook}
              onChange={updateSettings}
            />
            <FormField
              label="Alert Thresholds"
              type="number"
              label="Error Rate (%)"
              value={settings.errorRateThreshold}
              onChange={updateSettings}
            />
            <Button onClick={saveSettings}>Save Settings</Button>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
```

## Architecture

### Component Structure

```
app/admin/
├── page.tsx                    # Admin dashboard
├── users/
│   ├── page.tsx              # User management
│   ├── create/page.tsx         # Create user
│   └── [id]/page.tsx        # Edit user
├── venues/
│   ├── page.tsx              # Venue management
│   ├── create/page.tsx         # Create venue
│   └── [id]/page.tsx        # Edit venue
├── feature-flags/
│   ├── page.tsx              # Feature flags
│   ├── create/page.tsx         # Create feature flag
│   └── [id]/page.tsx        # Edit feature flag
├── ab-testing/
│   ├── page.tsx              # A/B testing
│   ├── create/page.tsx         # Create experiment
│   └── [id]/page.tsx        # View experiment results
├── analytics/
│   ├── page.tsx              # Analytics dashboard
│   ├── revenue/page.tsx       # Revenue analytics
│   └── orders/page.tsx        # Order analytics
├── billing/
│   ├── page.tsx              # Billing overview
│   ├── invoices/page.tsx      # Invoice history
│   └── plans/page.tsx         # Subscription plans
└── settings/
    └── page.tsx              # Platform settings
```

### API Routes

```typescript
// app/api/admin/users/route.ts
import { requireAdmin } from '@/lib/requireRole';

export async function GET(request: Request) {
  requireAdmin(request);

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const users = await getUsers(page, limit);

  return Response.json({ data: users });
}

export async function POST(request: Request) {
  requireAdmin(request);

  const body = await request.json();
  const user = await createUser(body);

  return Response.json({ data: user }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  requireAdmin(request);

  await deleteUser(params.id);

  return Response.json({ success: true });
}
```

## Security

### Role-Based Access Control

```typescript
// lib/admin/guards.ts
import { requireAdmin } from '@/lib/requireRole';

export function requireAdmin(request: Request) {
  const session = await getSession(request);
  if (!session?.user?.role?.includes('admin')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export function requireSuperAdmin(request: Request) {
  const session = await getSession(request);
  if (!session?.user?.role?.includes('superadmin')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

### Audit Logging

```typescript
// lib/admin/audit-logger.ts
import { supabase } from '@/lib/supabase';

export async function logAdminAction(
  userId: string,
  action: string,
  details?: any
) {
  await supabase.from('admin_audit_log').insert({
    userId,
    action,
    details,
    timestamp: new Date(),
    ipAddress: getClientIp(),
  });
}

export async function getAuditLogs(filters: any) {
  const { data } = await supabase
    .from('admin_audit_log')
    .select('*')
    .match(filters)
    .order('timestamp', { ascending: false })
    .limit(100);

  return data;
}
```

## Best Practices

### 1. Use Server Components

Use server components for better performance:

```typescript
// Good: Server component
export default async function UsersPage() {
  const users = await getUsers();

  return (
    <div>
      <UserList users={users} />
    </div>
  );
}

// Bad: Client component with data fetching
export default function UsersPage() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers().then(setUsers);
  }, []);

  return (
    <div>
      <UserList users={users} />
    </div>
  );
}
```

### 2. Implement Pagination

Use pagination for large datasets:

```typescript
// Good: Paginated API
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const users = await getUsers(page, limit);

  return Response.json({
    data: users,
    pagination: {
      page,
      limit,
      total: await getTotalUsers(),
    },
  });
}

// Bad: Load all data
export async function GET(request: Request) {
  const users = await getAllUsers(); // Could be thousands

  return Response.json({ data: users });
}
```

### 3. Add Search and Filters

Implement search and filtering:

```typescript
// Good: Search and filters
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const role = searchParams.get('role');
  const status = searchParams.get('status');

  const users = await getUsers({ search, role, status });

  return Response.json({ data: users });
}

// Bad: No search or filters
export async function GET(request: Request) {
  const users = await getAllUsers();

  return Response.json({ data: users });
}
```

### 4. Use Optimistic UI

Use optimistic UI for better UX:

```typescript
// Good: Optimistic updates
const [users, setUsers] = useState(users);

async function deleteUser(id: string) {
  // Optimistically remove user
  setUsers(users.filter(u => u.id !== id));

  // Then delete
  await deleteUserFromDB(id);
}

// Bad: Wait for server response
async function deleteUser(id: string) {
  await deleteUserFromDB(id);
  const users = await getUsers();
  setUsers(users);
}
```

### 5. Add Loading States

Show loading states for better UX:

```typescript
// Good: Loading states
const [loading, setLoading] = useState(false);

async function loadData() {
  setLoading(true);
  const data = await fetchData();
  setLoading(false);
  return data;
}

// Bad: No loading state
async function loadData() {
  return await fetchData();
}
```

### 6. Implement Error Handling

Handle errors gracefully:

```typescript
// Good: Error handling
try {
  const user = await createUser(data);
  return Response.json({ data: user }, { status: 201 });
} catch (error) {
  console.error('Error creating user:', error);
  return Response.json(
    { error: 'Failed to create user' },
    { status: 500 }
  );
}

// Bad: No error handling
const user = await createUser(data);
return Response.json({ data: user }, { status: 201 });
```

### 7. Add Confirmation Dialogs

Add confirmation for destructive actions:

```typescript
// Good: Confirmation dialog
async function deleteUser(id: string) {
  const confirmed = await confirm(
    'Are you sure you want to delete this user? This action cannot be undone.'
  );

  if (!confirmed) return;

  await deleteUserFromDB(id);
}

// Bad: No confirmation
async function deleteUser(id: string) {
  await deleteUserFromDB(id);
}
```

## References

- [Admin Panel Best Practices](https://www.smashingmagazine.com/2022/01/admin-panel-best-practices/)
- [React Admin Templates](https://github.com/mbrn/material-table)
- [Admin Dashboard Design](https://www.nngroup.com/blog/2019/01/29/admin-dashboard-design)
- [Admin UX Patterns](https://www.nngroup.com/blog/2019/01/29/admin-dashboard-design)

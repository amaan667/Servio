import { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Documentation",
  description: "Comprehensive API documentation for Servio platform",
};

export default function APIDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">API Documentation</h1>

          <div className="prose prose-lg max-w-none">
            <h2>Overview</h2>
            <p>
              The Servio API provides comprehensive endpoints for managing restaurants, orders,
              menus, and analytics. All endpoints are RESTful and return JSON responses.
            </p>

            <h2>Base URL</h2>
            <code className="bg-gray-100 px-2 py-1 rounded">
              {process.env.NEXT_PUBLIC_SITE_URL || "https://servio.app"}/api
            </code>

            <h2>Authentication</h2>
            <p>
              Most endpoints require authentication. Include the session cookie in your requests:
            </p>
            <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
              {`curl -X GET "https://servio.app/api/venues" \\
  -H "Cookie: sb-access-token=your-token"`}
            </pre>

            <h2>Error Handling</h2>
            <p>All endpoints return appropriate HTTP status codes:</p>
            <ul>
              <li>
                <code>200</code> - Success
              </li>
              <li>
                <code>400</code> - Bad Request
              </li>
              <li>
                <code>401</code> - Unauthorized
              </li>
              <li>
                <code>403</code> - Forbidden
              </li>
              <li>
                <code>404</code> - Not Found
              </li>
              <li>
                <code>500</code> - Internal Server Error
              </li>
            </ul>

            <h2>Endpoints</h2>

            <h3>Venues</h3>
            <div className="border rounded-lg p-4 mb-6">
              <h4>GET /api/venues</h4>
              <p>Get all venues for the authenticated user</p>
              <pre className="bg-gray-100 p-3 rounded mt-2">
                {`{
  "venues": [
    {
      "venue_id": "venue-123",
      "venue_name": "My Restaurant",
      "owner_user_id": "user-456",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}`}
              </pre>
            </div>

            <h3>Orders</h3>
            <div className="border rounded-lg p-4 mb-6">
              <h4>GET /api/orders</h4>
              <p>Get orders for a specific venue</p>
              <p>
                <strong>Query Parameters:</strong>
              </p>
              <ul>
                <li>
                  <code>venue_id</code> - Venue ID (required)
                </li>
                <li>
                  <code>status</code> - Order status filter (optional)
                </li>
                <li>
                  <code>limit</code> - Number of orders to return (optional, default: 50)
                </li>
              </ul>
              <pre className="bg-gray-100 p-3 rounded mt-2">
                {`{
  "orders": [
    {
      "order_id": "order-123",
      "venue_id": "venue-123",
      "table_number": "5",
      "status": "pending",
      "total_amount": 25.99,
      "items": [
        {
          "item_name": "Burger",
          "quantity": 1,
          "price": 12.99
        }
      ],
      "created_at": "2024-01-01T12:00:00Z"
    }
  ]
}`}
              </pre>
            </div>

            <h3>Menu Items</h3>
            <div className="border rounded-lg p-4 mb-6">
              <h4>GET /api/menu-items</h4>
              <p>Get menu items for a venue</p>
              <p>
                <strong>Query Parameters:</strong>
              </p>
              <ul>
                <li>
                  <code>venue_id</code> - Venue ID (required)
                </li>
                <li>
                  <code>category</code> - Category filter (optional)
                </li>
              </ul>

              <h4>POST /api/menu-items</h4>
              <p>Create a new menu item</p>
              <pre className="bg-gray-100 p-3 rounded mt-2">
                {`{
  "venue_id": "venue-123",
  "item_name": "Chicken Burger",
  "description": "Grilled chicken with lettuce and tomato",
  "price": 14.99,
  "category": "Main Course",
  "is_available": true
}`}
              </pre>
            </div>

            <h3>Analytics</h3>
            <div className="border rounded-lg p-4 mb-6">
              <h4>GET /api/analytics/revenue</h4>
              <p>Get revenue analytics for a venue</p>
              <p>
                <strong>Query Parameters:</strong>
              </p>
              <ul>
                <li>
                  <code>venue_id</code> - Venue ID (required)
                </li>
                <li>
                  <code>start_date</code> - Start date (ISO format)
                </li>
                <li>
                  <code>end_date</code> - End date (ISO format)
                </li>
                <li>
                  <code>group_by</code> - Group by day, week, or month
                </li>
              </ul>
            </div>

            <h3>QR Codes</h3>
            <div className="border rounded-lg p-4 mb-6">
              <h4>POST /api/qr-codes/generate</h4>
              <p>Generate QR codes for tables or counters</p>
              <pre className="bg-gray-100 p-3 rounded mt-2">
                {`{
  "venue_id": "venue-123",
  "type": "table",
  "name": "Table 5",
  "size": "medium"
}`}
              </pre>
            </div>

            <h2>Rate Limiting</h2>
            <p>
              API requests are rate limited to 1000 requests per hour per user. Rate limit headers
              are included in responses:
            </p>
            <ul>
              <li>
                <code>X-RateLimit-Limit</code> - Request limit per hour
              </li>
              <li>
                <code>X-RateLimit-Remaining</code> - Remaining requests in current window
              </li>
              <li>
                <code>X-RateLimit-Reset</code> - Time when the rate limit resets
              </li>
            </ul>

            <h2>Webhooks</h2>
            <p>
              Servio supports webhooks for real-time notifications. Configure webhook URLs in your
              venue settings to receive notifications for:
            </p>
            <ul>
              <li>New orders</li>
              <li>Order status changes</li>
              <li>Payment confirmations</li>
              <li>Menu updates</li>
            </ul>

            <h2>SDK and Libraries</h2>
            <p>Official SDKs are available for popular languages:</p>
            <ul>
              <li>
                JavaScript/TypeScript - <code>npm install @servio/sdk</code>
              </li>
              <li>
                Python - <code>pip install servio-sdk</code>
              </li>
              <li>
                PHP - <code>composer require servio/sdk</code>
              </li>
            </ul>

            <h2>Support</h2>
            <p>
              For API support and questions, please contact us at{" "}
              <a href="mailto:api@servio.app" className="text-blue-600 hover:underline">
                api@servio.app
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

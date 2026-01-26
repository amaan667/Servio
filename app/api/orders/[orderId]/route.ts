import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { orderService } from "@/lib/services/OrderService";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: Fetch a single order by ID
 * PUBLIC: Customers need this to track their order
 */
export const GET = createUnifiedHandler(
  async (_req, context) => {
    const { orderId } = context.params;

    if (!orderId) {
      return apiErrors.badRequest("Order ID is required");
    }

    // Try to get order from service (handles caching)
    // Note: We need venueId for the service call, but customers might not have it in the URL
    // We'll use a direct supabase call for public tracking or update OrderService
    const order = await orderService.getOrderByIdPublic(orderId);

    if (!order) {
      return apiErrors.notFound("Order not found");
    }

    return { order };
  },
  {
    requireAuth: false, // Public tracking
  }
);

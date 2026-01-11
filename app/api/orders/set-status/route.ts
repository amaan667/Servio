import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { cleanupTableOnOrderCompletion } from "@/lib/table-cleanup";
import { validateOrderCompletion } from "@/lib/orders/payment-validation";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { success, apiErrors } from "@/lib/api/standard-response";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      const { orderId, status } = await req.json();

      if (!orderId || !status) {
        return apiErrors.badRequest("Order ID and status are required");
      }

      // Validate status
      const validStatuses = ["IN_PREP", "READY", "SERVING", "SERVED", "COMPLETED", "CANCELLED"];
      if (!validStatuses.includes(status)) {
        return apiErrors.badRequest("Invalid status");
      }

      const adminSupabase = createAdminClient();

      // First get the order details before updating
      const { data: orderData, error: fetchError } = await adminSupabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("venue_id", context.venueId)
        .single();

      if (fetchError) {
        
        return apiErrors.internal("Internal server error");
      }

      // CRITICAL: Validate payment before allowing COMPLETED status
      if (status === "COMPLETED") {
        const validation = await validateOrderCompletion(adminSupabase, orderId);
        if (!validation.isValid) {
          
          return apiErrors.badRequest(validation.error || "Cannot complete unpaid order", {

        }
      }

      // Update the order status
      const { error } = await adminSupabase
        .from("orders")
        .update({ order_status: status })
        .eq("id", orderId)
        .eq("venue_id", context.venueId);

      if (error) {
        
        return apiErrors.internal(error.message || "Internal server error");
      }

      // Handle table clearing when order is completed or cancelled
      if (status === "COMPLETED" || status === "CANCELLED") {
        const order = orderData;
        if (order && (order.table_id || order.table_number)) {
          // Use centralized table cleanup function
          const cleanupResult = await cleanupTableOnOrderCompletion({

          if (!cleanupResult.success) {
            
          }
        }
      }

      return success({});
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
      
      return apiErrors.internal(errorMessage);
    }
  },
  {
    // Extract venueId from order record

          const { createAdminClient } = await import("@/lib/supabase");
          const adminSupabase = createAdminClient();
          const { data: order } = await adminSupabase
            .from("orders")
            .select("venue_id")
            .eq("id", orderId)
            .single();
          if (order?.venue_id) {
            return order.venue_id;
          }
        }
      } catch {
        // Fallback to query/body
      }
      const url = new URL(req.url);
      return url.searchParams.get("venueId") || url.searchParams.get("venue_id");
    },
  }
);

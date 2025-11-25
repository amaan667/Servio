import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
  image?: string;
}

interface StoreCartRequest {
  cartId: string;
  venueId: string;
  tableNumber: number;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  total: number;
  notes?: string;
}

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const body: StoreCartRequest = await req.json();
      const { cartId, tableNumber, customerName, customerPhone, items, total, notes } = body;

      if (!cartId || !items || items.length === 0) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      // Store cart data in a temporary table or use a simple approach
      // For now, we'll use a simple JSON storage approach
      const cartData = {
        id: cartId,
        venue_id: context.venueId,
        table_number: tableNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        items: items.map((item) => ({
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || null,
          image: item.image || null,
        })),
        total_amount: total,
        notes: notes || null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      };

      // Store in a temporary carts table (you might want to create this)
      // For now, we'll return the cart data to be stored client-side
      return NextResponse.json({
        success: true,
        cartData,
      });
    } catch (_error) {
      logger.error("[CART STORE] Error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }
);

export async function GET(req: NextRequest) {
  try {
    // Basic auth check only (no venue required for cart retrieval)
    const { requireAuthForAPI } = await import('@/lib/auth/api');
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const cartId = searchParams.get("cartId");

    if (!cartId) {
      return NextResponse.json({ error: "Missing cart ID" }, { status: 400 });
    }

    // In a real implementation, you'd retrieve from database
    // For now, return null to indicate cart not found
    return NextResponse.json({
      success: true,
      cartData: null,
    });
  } catch (_error) {
    logger.error("[CART STORE] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

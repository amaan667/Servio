/**
 * API v2 Orders Endpoint
 * Improved version with standardized handler and better response format
 *
 * @swagger
 * /api/v2/orders:
 *   get:
 *     summary: Get orders (v2)
 *     tags: [Orders]
 *     description: Improved API with standardized response format
 *     parameters:
 *       - in: query
 *         name: venueId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, preparing, ready, served, cancelled]
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Order'
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 */

import { createGetHandler } from "@/lib/api/universal-handler";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

const querySchema = z.object({
  venueId: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "preparing", "ready", "served", "cancelled"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const GET = createGetHandler(
  async (context) => {
    const { req, venueId } = context;
    if (!venueId) {
      throw new Error("venueId is required");
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    const supabase = await createClient();

    let query = supabase
      .from("orders")
      .select("*", { count: "exact" })
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) {
      query = query.eq("order_status", status);
    }

    const { data: orders, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch orders: ${error.message}`);
    }

    return {
      orders: orders || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  },
  {
    requireAuth: true,
    requireVenueAccess: true,
    venueIdSource: "query",
    logRequest: true,
    logResponse: true,
    trackPerformance: true,
  }
);

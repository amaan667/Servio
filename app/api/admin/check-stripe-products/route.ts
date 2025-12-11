import { NextResponse } from "next/server";
import { apiErrors } from "@/lib/api/standard-response";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";

/**
 * Admin endpoint to check Stripe products and their usage
 * Helps identify which products can be safely deleted
 */
export async function GET() {
  try {
    const { createClient } = await import("@/lib/supabase");
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrors.unauthorized("Unauthorized");
    }

    // Admin role check
    const { data: userRole } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "admin" && userRole?.role !== "owner") {
      return apiErrors.forbidden("Admin access required");
    }
    // Get all products
    const products = await stripe.products.list({ limit: 100, active: true });

    const productAnalysis = [];

    for (const product of products.data) {
      const tier = product.metadata?.tier;

      // Get all prices for this product
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 100,
      });

      // Check if any prices have active subscriptions
      const subscriptionCounts: Record<string, number> = {};
      let totalActiveSubscriptions = 0;
      let totalInactiveSubscriptions = 0;

      for (const price of prices.data) {
        // Count subscriptions using this price
        const subscriptions = await stripe.subscriptions.list({
          price: price.id,
          status: "all",
          limit: 100,
        });

        subscriptions.data.forEach((sub) => {
          const status = sub.status;
          subscriptionCounts[status] = (subscriptionCounts[status] || 0) + 1;

          if (status === "active" || status === "trialing") {
            totalActiveSubscriptions++;
          } else {
            totalInactiveSubscriptions++;
          }
        });
      }

      // Determine if product is safe to delete
      const hasActiveSubscriptions = totalActiveSubscriptions > 0;
      const isLatestForTier = tier && ["starter", "pro", "enterprise"].includes(tier);

      productAnalysis.push({
        productId: product.id,
        name: product.name,
        description: product.description,
        created: new Date(product.created * 1000).toISOString(),
        tier: tier || "unknown",
        priceCount: prices.data.length,
        prices: prices.data.map((p) => ({
          id: p.id,
          amount: p.unit_amount ? p.unit_amount / 100 : null,
          currency: p.currency,
          created: new Date(p.created * 1000).toISOString(),
        })),
        activeSubscriptions: totalActiveSubscriptions,
        inactiveSubscriptions: totalInactiveSubscriptions,
        subscriptionCounts,
        hasActiveSubscriptions,
        canDelete: !hasActiveSubscriptions && totalInactiveSubscriptions === 0,
        recommendation: hasActiveSubscriptions
          ? "KEEP - Has active subscriptions"
          : totalInactiveSubscriptions > 0
            ? "ARCHIVE - Has inactive subscriptions (archive instead of delete)"
            : isLatestForTier
              ? "KEEP - Latest product for tier"
              : "CAN DELETE - No subscriptions",
      });
    }

    // Group by tier
    const productsByTier: Record<string, typeof productAnalysis> = {
      starter: [],
      pro: [],
      enterprise: [],
      unknown: [],
    };

    productAnalysis.forEach((p) => {
      const tierKey =
        p.tier === "starter" || p.tier === "basic"
          ? "starter"
          : p.tier === "pro" || p.tier === "standard"
            ? "pro"
            : p.tier === "enterprise" || p.tier === "premium"
              ? "enterprise"
              : "unknown";
      productsByTier[tierKey].push(p);
    });

    // Sort by created date (newest first)
    Object.keys(productsByTier).forEach((key) => {
      productsByTier[key].sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
      );
    });

    // Find recommended products to keep (most recent with correct tier metadata)
    const recommendedProducts = {
      starter:
        productsByTier.starter.find((p) => p.tier === "starter" && !p.hasActiveSubscriptions) ||
        productsByTier.starter[0],
      pro:
        productsByTier.pro.find((p) => p.tier === "pro" && !p.hasActiveSubscriptions) ||
        productsByTier.pro[0],
      enterprise:
        productsByTier.enterprise.find(
          (p) => p.tier === "enterprise" && !p.hasActiveSubscriptions
        ) || productsByTier.enterprise[0],
    };

    const productsToDelete = productAnalysis.filter((p) => p.canDelete);
    const productsToArchive = productAnalysis.filter(
      (p) => !p.canDelete && !p.hasActiveSubscriptions && p.inactiveSubscriptions > 0
    );

    return NextResponse.json({
      success: true,
      summary: {
        totalProducts: products.data.length,
        productsWithActiveSubscriptions: productAnalysis.filter((p) => p.hasActiveSubscriptions)
          .length,
        canDelete: productsToDelete.length,
        shouldArchive: productsToArchive.length,
      },
      recommendedProducts,
      productsByTier,
      productsToDelete: productsToDelete.map((p) => ({
        productId: p.productId,
        name: p.name,
        tier: p.tier,
        created: p.created,
        reason: "No subscriptions found",
      })),
      productsToArchive: productsToArchive.map((p) => ({
        productId: p.productId,
        name: p.name,
        tier: p.tier,
        inactiveSubscriptions: p.inactiveSubscriptions,
        reason: "Has inactive subscriptions - archive instead of delete",
      })),
      allProducts: productAnalysis,
    });
  } catch (error) {
    logger.error("[ADMIN] Error checking Stripe products:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

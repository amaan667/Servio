"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  BarChart3,
  PieChart,
  Calculator,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase";

interface MenuItemProfitability {
  menu_item_id: string;
  name: string;
  category: string;
  price: number;
  cogs: number; // Cost of Goods Sold
  revenue: number;
  quantity_sold: number;
  profit: number;
  margin_percentage: number;
}

interface CostInsightsData {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMargin: number;
  averageMargin: number;
  itemProfitability: MenuItemProfitability[];
  categoryBreakdown: Array<{
    category: string;
    revenue: number;
    cogs: number;
    profit: number;
    margin: number;
  }>;
  lowMarginItems: MenuItemProfitability[];
  highMarginItems: MenuItemProfitability[];
}

interface CostInsightsProps {
  venueId: string;
  timePeriod?: "7d" | "30d" | "90d" | "all";
}

export function CostInsights({ venueId, timePeriod = "30d" }: CostInsightsProps) {
  const [data, setData] = useState<CostInsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCostInsights();
  }, [venueId, timePeriod]);

  const fetchCostInsights = async () => {
    try {
      setError(null);

      const supabase = supabaseBrowser();
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      switch (timePeriod) {
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0); // All time
      }

      // Fetch all data in parallel for faster loading
      const [ordersResult, menuItemsResult] = await Promise.all([
        supabase
          .from("orders")
          .select("id, items, total_amount, created_at")
          .eq("venue_id", normalizedVenueId)
          .eq("order_status", "COMPLETED")
          .eq("payment_status", "PAID")
          .gte("created_at", startDate.toISOString())
          .order("created_at", { ascending: false }),
        supabase
          .from("menu_items")
          .select("id, name, category, price")
          .eq("venue_id", normalizedVenueId)
          .eq("is_available", true),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (menuItemsResult.error) throw menuItemsResult.error;

      const orders = ordersResult.data || [];
      const menuItems = menuItemsResult.data || [];

      // Fetch recipe costs in parallel (batch query)
      const recipeCosts = new Map<string, number>();
      
      if (menuItems.length > 0) {
        // Batch fetch all recipes at once
        const { data: allRecipes } = await supabase
          .from("menu_item_ingredients")
          .select(
            `
            menu_item_id,
            qty_per_item,
            ingredient:ingredients(cost_per_unit)
          `
          )
          .in("menu_item_id", menuItems.map((item) => item.id));

        // Process recipes
        if (allRecipes) {
          type RecipeType = {
            menu_item_id: string;
            qty_per_item: number;
            ingredient?: { cost_per_unit: number } | null;
          };
          const recipeMap = new Map<string, RecipeType[]>();
          allRecipes.forEach((recipe: unknown) => {
            const recipeTyped = recipe as {
              menu_item_id: string;
              qty_per_item: number;
              ingredient?: { cost_per_unit: number } | null;
            };
            if (!recipeMap.has(recipeTyped.menu_item_id)) {
              recipeMap.set(recipeTyped.menu_item_id, []);
            }
            recipeMap.get(recipeTyped.menu_item_id)!.push(recipeTyped);
          });

          // Calculate costs for each item
          menuItems.forEach((item) => {
            const recipes = recipeMap.get(item.id) || [];
            const totalCost = recipes.reduce(
              (sum: number, recipe: RecipeType) => {
                const ingredientCost = recipe.ingredient?.cost_per_unit || 0;
                return sum + ingredientCost * (recipe.qty_per_item || 0);
              },
              0
            );
            recipeCosts.set(item.id, totalCost);
          });
        }
      }

      // Calculate profitability for each menu item
      const itemStats = new Map<string, MenuItemProfitability>();

      // Process orders to calculate revenue and quantities
      (orders || []).forEach((order) => {
        const items = (order.items as Array<{
          menu_item_id?: string;
          id?: string;
          item_name?: string;
          name?: string;
          quantity?: number;
          price?: number;
        }>) || [];
        items.forEach((item) => {
          const menuItemId = (item.menu_item_id || item.id) as string;
          const itemName = item.item_name || item.name || "Unknown";
          const quantity = item.quantity || 1;
          const price = item.price || 0;
          const revenue = price * quantity;

          // Find menu item to get category
          const menuItem = menuItems?.find((mi) => mi.id === menuItemId);
          const category = menuItem?.category || "Uncategorized";
          const cogsPerUnit = recipeCosts.get(menuItemId) || 0;
          const cogs = cogsPerUnit * quantity;

          const existing = itemStats.get(menuItemId);
          if (existing) {
            existing.revenue += revenue;
            existing.quantity_sold += quantity;
            existing.cogs += cogs;
            existing.profit = existing.revenue - existing.cogs;
            existing.margin_percentage =
              existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : 0;
          } else {
            const profit = revenue - cogs;
            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
            itemStats.set(menuItemId, {
              menu_item_id: menuItemId,
              name: itemName,
              category,
              price,
              cogs: cogs,
              revenue,
              quantity_sold: quantity,
              profit,
              margin_percentage: margin,
            });
          }
        });
      });

      const itemProfitability = Array.from(itemStats.values());

      // Calculate totals
      const totalRevenue = itemProfitability.reduce((sum, item) => sum + item.revenue, 0);
      const totalCOGS = itemProfitability.reduce((sum, item) => sum + item.cogs, 0);
      const grossProfit = totalRevenue - totalCOGS;
      const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const averageMargin =
        itemProfitability.length > 0
          ? itemProfitability.reduce((sum, item) => sum + item.margin_percentage, 0) /
            itemProfitability.length
          : 0;

      // Category breakdown
      const categoryMap = new Map<string, { revenue: number; cogs: number; profit: number }>();
      itemProfitability.forEach((item) => {
        const existing = categoryMap.get(item.category);
        if (existing) {
          existing.revenue += item.revenue;
          existing.cogs += item.cogs;
          existing.profit += item.profit;
        } else {
          categoryMap.set(item.category, {
            revenue: item.revenue,
            cogs: item.cogs,
            profit: item.profit,
          });
        }
      });

      const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, stats]) => ({
        category,
        ...stats,
        margin: stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0,
      }));

      // Sort items by margin
      const sortedByMargin = [...itemProfitability].sort(
        (a, b) => a.margin_percentage - b.margin_percentage
      );
      const lowMarginItems = sortedByMargin.slice(0, 5);
      const highMarginItems = sortedByMargin.slice(-5).reverse();

      setData({
        totalRevenue,
        totalCOGS,
        grossProfit,
        grossMargin,
        averageMargin,
        itemProfitability,
        categoryBreakdown,
        lowMarginItems,
        highMarginItems,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cost insights");
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <p>{error}</p>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Make sure you have set up recipes for your menu items to calculate costs.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show empty state while loading - no spinner
  if (!data && !error) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">-</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">-</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Key Profitability Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Gross Profit"
          value={`£${data.grossProfit.toFixed(2)}`}
          subtitle={`${data.grossMargin.toFixed(1)}% margin`}
          icon={<DollarSign className="h-4 w-4 text-green-600" />}
          trend={data.grossMargin > 30 ? +data.grossMargin : -data.grossMargin}
        />
        <MetricCard
          title="Total Revenue"
          value={`£${data.totalRevenue.toFixed(2)}`}
          subtitle="From completed orders"
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
        />
        <MetricCard
          title="Total COGS"
          value={`£${data.totalCOGS.toFixed(2)}`}
          subtitle="Cost of goods sold"
          icon={<Package className="h-4 w-4 text-orange-600" />}
        />
        <MetricCard
          title="Avg Margin"
          value={`${data.averageMargin.toFixed(1)}%`}
          subtitle="Per menu item"
          icon={<Calculator className="h-4 w-4 text-purple-600" />}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Profitability Overview</TabsTrigger>
          <TabsTrigger value="items">Item Analysis</TabsTrigger>
          <TabsTrigger value="categories">Category Breakdown</TabsTrigger>
          <TabsTrigger value="alerts">Low Margin Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Profit Margin Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Profit vs Cost Breakdown
                </CardTitle>
                <CardDescription>Visual breakdown of revenue, COGS, and profit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Revenue</span>
                      <span className="text-sm font-semibold">£{data.totalRevenue.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-green-600 h-4 rounded-full"
                        style={{ width: "100%" }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">COGS</span>
                      <span className="text-sm font-semibold">£{data.totalCOGS.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-orange-600 h-4 rounded-full"
                        style={{
                          width: `${(data.totalCOGS / data.totalRevenue) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Gross Profit</span>
                      <span className="text-sm font-semibold text-green-600">
                        £{data.grossProfit.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-green-500 h-4 rounded-full"
                        style={{
                          width: `${data.grossMargin}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Margin Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Margin Distribution
                </CardTitle>
                <CardDescription>How many items fall into each margin range</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "High Margin (>50%)", threshold: 50, color: "bg-green-500" },
                    { label: "Good Margin (30-50%)", threshold: 30, color: "bg-blue-500" },
                    { label: "Low Margin (10-30%)", threshold: 10, color: "bg-yellow-500" },
                    { label: "Very Low (<10%)", threshold: 0, color: "bg-red-500" },
                  ].map((range) => {
                    const count = data.itemProfitability.filter((item) => {
                      if (range.label.includes(">50")) return item.margin_percentage > 50;
                      if (range.label.includes("30-50"))
                        return item.margin_percentage >= 30 && item.margin_percentage <= 50;
                      if (range.label.includes("10-30"))
                        return item.margin_percentage >= 10 && item.margin_percentage < 30;
                      return item.margin_percentage < 10;
                    }).length;

                    return (
                      <div key={range.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${range.color}`}></div>
                          <span className="text-sm">{range.label}</span>
                        </div>
                        <span className="font-semibold">{count} items</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Most Profitable Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Most Profitable Items
                </CardTitle>
                <CardDescription>Top items by profit margin</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.highMarginItems.map((item) => (
                    <div key={item.menu_item_id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          {item.margin_percentage.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          £{item.profit.toFixed(2)} profit
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Least Profitable Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  Low Margin Items
                </CardTitle>
                <CardDescription>Items needing attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.lowMarginItems.map((item) => (
                    <div key={item.menu_item_id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-red-600">
                          {item.margin_percentage.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          £{item.profit.toFixed(2)} profit
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Full Item List */}
          <Card>
            <CardHeader>
              <CardTitle>All Items Profitability</CardTitle>
              <CardDescription>Complete breakdown by menu item</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 text-sm font-medium">Item</th>
                      <th className="text-right py-2 px-2 text-sm font-medium">Sold</th>
                      <th className="text-right py-2 px-2 text-sm font-medium">Revenue</th>
                      <th className="text-right py-2 px-2 text-sm font-medium">COGS</th>
                      <th className="text-right py-2 px-2 text-sm font-medium">Profit</th>
                      <th className="text-right py-2 px-2 text-sm font-medium">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.itemProfitability
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((item) => (
                        <tr key={item.menu_item_id} className="border-b">
                          <td className="py-2 px-2">
                            <div>
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.category}</p>
                            </div>
                          </td>
                          <td className="text-right py-2 px-2 text-sm">{item.quantity_sold}</td>
                          <td className="text-right py-2 px-2 text-sm">
                            £{item.revenue.toFixed(2)}
                          </td>
                          <td className="text-right py-2 px-2 text-sm">
                            £{item.cogs.toFixed(2)}
                          </td>
                          <td
                            className={`text-right py-2 px-2 text-sm font-semibold ${
                              item.profit >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            £{item.profit.toFixed(2)}
                          </td>
                          <td
                            className={`text-right py-2 px-2 text-sm font-semibold ${
                              item.margin_percentage >= 30
                                ? "text-green-600"
                                : item.margin_percentage >= 10
                                  ? "text-yellow-600"
                                  : "text-red-600"
                            }`}
                          >
                            {item.margin_percentage.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Category Profitability</CardTitle>
              <CardDescription>Breakdown by menu category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.categoryBreakdown
                  .sort((a, b) => b.profit - a.profit)
                  .map((cat) => (
                    <div key={cat.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{cat.category}</span>
                        <span
                          className={`font-semibold ${
                            cat.margin >= 30 ? "text-green-600" : cat.margin >= 10 ? "text-yellow-600" : "text-red-600"
                          }`}
                        >
                          {cat.margin.toFixed(1)}% margin
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Revenue</p>
                          <p className="font-semibold">£{cat.revenue.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">COGS</p>
                          <p className="font-semibold">£{cat.cogs.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Profit</p>
                          <p className="font-semibold text-green-600">£{cat.profit.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            cat.margin >= 30 ? "bg-green-500" : cat.margin >= 10 ? "bg-yellow-500" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(cat.margin, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Low Margin Alerts
              </CardTitle>
              <CardDescription>
                Items with margins below 20% - consider reviewing pricing or costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.lowMarginItems.filter((item) => item.margin_percentage < 20).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No low margin alerts! All items are performing well.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.lowMarginItems
                    .filter((item) => item.margin_percentage < 20)
                    .map((item) => (
                      <div
                        key={item.menu_item_id}
                        className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.category}</p>
                          <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Price</p>
                              <p className="font-semibold">£{item.price.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">COGS</p>
                              <p className="font-semibold">
                                £{(item.cogs / item.quantity_sold).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Margin</p>
                              <p className="font-semibold text-red-600">
                                {item.margin_percentage.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {subtitle}
          {trend !== undefined && (
            <span className={`flex items-center ${trend > 0 ? "text-green-600" : "text-red-600"}`}>
              {trend > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}


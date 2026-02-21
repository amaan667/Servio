/**
 * Bulk Export API Route
 *
 * Handles bulk export and template generation requests.
 */

import { NextRequest, NextResponse } from "next/server";
import { menuService } from "@/lib/services/MenuService";
import { inventoryService } from "@/lib/services/InventoryService";
import { orderService } from "@/lib/services/OrderService";
import { tableService } from "@/lib/services/TableService";
import { BulkExportRequest } from "@/lib/bulk-operations/types";
import { logger } from "@/lib/monitoring/structured-logger";

export const runtime = "nodejs";

const handlePost = async (req: NextRequest): Promise<NextResponse> => {
  try {
    const body = (await req.json()) as BulkExportRequest;
    const { venueId, entityType, format, options } = body;

    if (!venueId || !entityType) {
      return NextResponse.json(
        { error: "Missing required fields: venueId, entityType" },
        { status: 400 }
      );
    }

    let data: Record<string, unknown>[] = [];
    let fields: string[] = [];

    switch (entityType) {
      case "menu_items": {
        const items = await menuService.getMenuItems(venueId);
        data = items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          is_available: item.is_available,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));
        fields = [
          "id",
          "name",
          "description",
          "price",
          "category",
          "is_available",
          "created_at",
          "updated_at",
        ];
        break;
      }

      case "inventory_items": {
        const items = await inventoryService.getInventory(venueId);
        data = items.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          on_hand: item.on_hand,
          min_stock: item.min_stock,
          cost_per_unit: item.cost_per_unit,
          category: item.category,
          supplier: item.supplier,
          updated_at: item.updated_at,
        }));
        fields = [
          "id",
          "name",
          "sku",
          "unit",
          "on_hand",
          "min_stock",
          "cost_per_unit",
          "category",
          "supplier",
          "updated_at",
        ];
        break;
      }

      case "orders": {
        const orders = await orderService.getOrders(venueId);
        data = orders.map((order) => ({
          id: order.id,
          table_number: order.table_number,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          total_amount: order.total_amount,
          order_status: order.order_status,
          payment_status: order.payment_status,
          source: order.source,
          created_at: order.created_at,
          updated_at: order.updated_at,
        }));
        fields = [
          "id",
          "table_number",
          "customer_name",
          "customer_phone",
          "total_amount",
          "order_status",
          "payment_status",
          "source",
          "created_at",
          "updated_at",
        ];
        break;
      }

      case "tables": {
        const tables = await tableService.getTables(venueId);
        data = tables.map((table) => ({
          id: table.id,
          table_number: table.table_number,
          label: table.label,
          section: table.section,
          seat_count: table.seat_count,
          status: table.status,
          is_active: table.is_active,
          created_at: table.created_at,
          updated_at: table.updated_at,
        }));
        fields = [
          "id",
          "table_number",
          "label",
          "section",
          "seat_count",
          "status",
          "is_active",
          "created_at",
          "updated_at",
        ];
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unsupported entity type: ${entityType}` },
          { status: 400 }
        );
    }

    if (options?.previewFirst) {
      return NextResponse.json({
        success: true,
        preview: {
          totalRecords: data.length,
          sampleData: data.slice(0, 5),
        },
      });
    }

    // Generate CSV content
    if (format === "csv") {
      const csvHeaders = fields.join(",");
      const csvRows = data.map((row) =>
        fields
          .map((field) => {
            const value = row[field];
            const stringValue = String(value ?? "");
            if (
              stringValue.includes(",") ||
              stringValue.includes('"') ||
              stringValue.includes("\n")
            ) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(",")
      );
      const csvContent = [csvHeaders, ...csvRows].join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${entityType}_export.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data,
      meta: {
        entityType,
        totalRecords: data.length,
        exportedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Bulk export error:", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handlePost(req);
}

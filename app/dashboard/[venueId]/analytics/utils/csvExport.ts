import { toCSV, formatDateForCSV, formatCurrencyForCSV } from "@/lib/csv";
import { generateTimestampedFilename } from "@/hooks/useCsvDownload";

export function prepareCSVData(orders: unknown[]): Record<string, unknown>[] {
  const csvRows: Record<string, unknown>[] = [];

  (orders as Record<string, unknown>[]).forEach((order: Record<string, unknown>) => {
    const createdAt = typeof order.created_at === "string" ? order.created_at : "";
    const tableNumber =
      typeof order.table_number === "number"
        ? order.table_number
        : typeof order.table_number === "string"
          ? order.table_number
          : "N/A";
    const paymentMethod = typeof order.payment_method === "string" ? order.payment_method : "";
    const totalAmount = typeof order.total_amount === "number" ? order.total_amount : 0;

    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item: Record<string, unknown>) => {
        const itemName =
          (typeof item.item_name === "string" ? item.item_name : null) ||
          (typeof item.name === "string" ? item.name : null) ||
          "Unknown Item";
        const quantity = typeof item.quantity === "number" ? item.quantity : 0;
        const price = typeof item.price === "number" ? item.price : 0;

        csvRows.push({
          date: formatDateForCSV(createdAt),
          table: tableNumber,
          item: itemName,
          quantity: quantity,
          price: formatCurrencyForCSV(price),
          total: formatCurrencyForCSV(quantity * price),
          paymentMethod: getPaymentMethodLabel(paymentMethod),
        });
      });
    } else {
      csvRows.push({
        date: formatDateForCSV(createdAt),
        table: tableNumber,
        item: "Order Total",
        quantity: 1,
        price: formatCurrencyForCSV(totalAmount),
        total: formatCurrencyForCSV(totalAmount),
        paymentMethod: getPaymentMethodLabel(paymentMethod),
      });
    }
  });

  return csvRows;
}

export function getCSVColumns() {
  return [
    { key: "date" as const, header: "Date" },
    { key: "table" as const, header: "Table" },
    { key: "item" as const, header: "Item" },
    { key: "quantity" as const, header: "Quantity" },
    { key: "price" as const, header: "Price" },
    { key: "total" as const, header: "Total" },
    { key: "paymentMethod" as const, header: "Payment Method" },
  ];
}

export function generateCSV(csvRows: Record<string, unknown>[]): string {
  const columns = getCSVColumns();
  return toCSV(csvRows, columns as { key: string; header: string }[]);
}

export function getCSVFilename() {
  return generateTimestampedFilename("servio-analytics");
}

function getPaymentMethodLabel(paymentMethod: string | null | undefined): string {
  if (!paymentMethod) return "Unknown";
  const method = String(paymentMethod).toLowerCase();
  switch (method) {
    case "stripe":
      return "Card";
    case "till":
      return "Cash";
    case "demo":
      return "Demo";
    default:
      return "Unknown";
  }
}

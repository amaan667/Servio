import { TableOrderGroupCard } from "@/components/table-management/TableOrderGroupCard";

interface TableOrdersSectionProps {
  groupedTableOrders: { [key: string]: unknown[] };
  venueId: string;
}

export function TableOrdersSection({ groupedTableOrders, venueId }: TableOrdersSectionProps) {
  if (Object.keys(groupedTableOrders).length === 0) {
    return null;
  }

  return (
    <section className="mt-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Table Orders</h2>
        <p className="text-sm text-gray-900">
          Orders grouped by table - manage service flow ({Object.keys(groupedTableOrders).length}{" "}
          tables with orders)
        </p>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max">
          {Object.entries(groupedTableOrders)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([tableKey, orders]) => (
              <div key={tableKey} className="flex-shrink-0 w-96">
                <TableOrderGroupCard
                  tableLabel={tableKey}
                  orders={orders as any}
                  venueId={venueId}
                />
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}

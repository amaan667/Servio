import { TableCardNew } from "@/components/table-management/TableCardNew";
import { TableGridItem } from "@/hooks/useTableReservations";

interface TableGridSectionProps {
  tables: TableGridItem[];
  searchQuery: string;
  venueId: string;
  onTableActionComplete: () => void;
}

export function TableGridSection({
  tables,
  searchQuery,
  venueId,
  onTableActionComplete,
}: TableGridSectionProps) {
  const filteredTables = tables.filter((table) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      table.label?.toLowerCase().includes(query) ||
      table.id?.toString().includes(query) ||
      table.session_status?.toLowerCase().includes(query) ||
      table.reservation_status?.toLowerCase().includes(query)
    );
  });

  return (
    <section className="mt-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-2">All Tables</h2>
        <p className="text-sm text-gray-900">
          {filteredTables.length} of {tables.length} tables
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTables.map((table) => (
          <TableCardNew
            key={table.id}
            table={table}
            venueId={venueId}
            onActionComplete={onTableActionComplete}
            availableTables={tables.filter((t) => t.id !== table.id && t.session_status === "FREE")}
          />
        ))}
      </div>
    </section>
  );
}

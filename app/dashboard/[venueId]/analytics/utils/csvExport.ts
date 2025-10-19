import { toCSV, formatDateForCSV, formatCurrencyForCSV } from '@/lib/csv';
import { generateTimestampedFilename } from '@/hooks/useCsvDownload';

export function prepareCSVData(orders: any[]) {
  const csvRows: any[] = [];
  
  orders.forEach((order: any) => {
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item: any) => {
        csvRows.push({
          date: formatDateForCSV(order.created_at),
          table: order.table_number || 'N/A',
          item: item.item_name || item.name || 'Unknown Item',
          quantity: item.quantity || 0,
          price: formatCurrencyForCSV(item.price || 0),
          total: formatCurrencyForCSV((item.quantity || 0) * (item.price || 0)),
          paymentMethod: getPaymentMethodLabel(order.payment_method)
        });
      });
    } else {
      csvRows.push({
        date: formatDateForCSV(order.created_at),
        table: order.table_number || 'N/A',
        item: 'Order Total',
        quantity: 1,
        price: formatCurrencyForCSV(order.total_amount || 0),
        total: formatCurrencyForCSV(order.total_amount || 0),
        paymentMethod: getPaymentMethodLabel(order.payment_method)
      });
    }
  });

  return csvRows;
}

export function getCSVColumns() {
  return [
    { key: 'date' as const, header: 'Date' },
    { key: 'table' as const, header: 'Table' },
    { key: 'item' as const, header: 'Item' },
    { key: 'quantity' as const, header: 'Quantity' },
    { key: 'price' as const, header: 'Price' },
    { key: 'total' as const, header: 'Total' },
    { key: 'paymentMethod' as const, header: 'Payment Method' }
  ];
}

export function generateCSV(csvRows: any[]) {
  const columns = getCSVColumns();
  return toCSV(csvRows, columns);
}

export function getCSVFilename() {
  return generateTimestampedFilename('servio-analytics');
}

function getPaymentMethodLabel(paymentMethod: string): string {
  switch (paymentMethod) {
    case 'stripe':
      return 'Card';
    case 'till':
      return 'Cash';
    case 'demo':
      return 'Demo';
    default:
      return 'Unknown';
  }
}


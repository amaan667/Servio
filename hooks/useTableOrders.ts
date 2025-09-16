import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { todayWindowForTZ } from '@/lib/time';

const supabase = createClient();

export interface TableOrder {
	id: string;
	table_number: number;
	customer_name: string | null;
	customer_phone: string | null;
	order_status: string;
	payment_status: string;
	total_amount: number;
	created_at: string;
	updated_at: string;
	source: 'qr' | 'counter';
	table_label: string | null;
	items: Array<{
		item_name: string;
		quantity: number;
		price: number;
	}>;
}

// Get active table orders (orders with source = 'qr' and active status)
export function useTableOrders(venueId: string) {
	return useQuery({
		queryKey: ['table-orders', venueId],
		queryFn: async () => {
			// Use proper daily reset logic - only show orders from today
			const todayWindow = todayWindowForTZ('Europe/London');
			const todayStartISO = todayWindow.startUtcISO;
			const todayEndISO = todayWindow.endUtcISO;

			const { data, error } = await supabase
				.from('orders')
				.select(`
					id,
					table_number,
					customer_name,
					customer_phone,
					order_status,
					payment_status,
					total_amount,
					created_at,
					updated_at,
					source,
					items
				`)
				.eq('venue_id', venueId)
				.eq('source', 'qr')
				// Only orders from today (proper daily reset logic)
				.gte('created_at', todayStartISO)
				.lt('created_at', todayEndISO)
				// Active statuses per requirement
				.in('order_status', ['PLACED', 'IN_PREP', 'READY', 'SERVING', 'SERVED', 'COMPLETED'])
				.order('created_at', { ascending: false });

			if (error) throw error;
			
			// Get table labels for each order using table_number
			const ordersWithTableLabels = await Promise.all(
				(data || []).map(async (order: any) => {
					let tableLabel = null;
					
					// Get table label using table_number
					if (order.table_number) {
						// Check if this is a counter order or table order
						const defaultLabel = order.source === 'counter' 
							? `Counter ${order.table_number}` 
							: `Table ${order.table_number}`;
							
						const { data: tableData } = await supabase
							.from('table_runtime_state')
							.select('label')
							.eq('venue_id', venueId)
							.eq('label', defaultLabel)
							.single();
						tableLabel = tableData?.label || defaultLabel;
					}
					
					return {
						...order,
						table_label: tableLabel || (order.table_number ? 
							(order.source === 'counter' ? `Counter ${order.table_number}` : `Table ${order.table_number}`) 
							: 'Unknown Table'),
					} as TableOrder;
				})
			);
			
			return ordersWithTableLabels;
		},
		refetchInterval: 15000,
	});
}

// Get table order counts
export function useTableOrderCounts(venueId: string) {
	return useQuery({
		queryKey: ['table-order-counts', venueId],
		queryFn: async () => {
			// Use proper daily reset logic - only count orders from today
			const todayWindow = todayWindowForTZ('Europe/London');
			const todayStartISO = todayWindow.startUtcISO;
			const todayEndISO = todayWindow.endUtcISO;

			const { data, error } = await supabase
				.from('orders')
				.select('order_status, source, created_at')
				.eq('venue_id', venueId)
				.eq('source', 'qr')
				// Only orders from today (proper daily reset logic)
				.gte('created_at', todayStartISO)
				.lt('created_at', todayEndISO)
				.in('order_status', ['PLACED', 'IN_PREP', 'READY', 'SERVING', 'SERVED', 'COMPLETED']);

			if (error) throw error;
			
			const total = data?.length || 0;
			const byStatus = data?.reduce((acc: Record<string, number>, order: any) => {
				acc[order.order_status] = (acc[order.order_status] || 0) + 1;
				return acc;
			}, {} as Record<string, number>) || {};

			return {
				total,
				placed: byStatus.PLACED || 0,
				in_prep: byStatus.IN_PREP || 0,
				ready: byStatus.READY || 0,
				serving: (byStatus.SERVING || 0) + (byStatus.SERVED || 0),
			};
		},
		refetchInterval: 15000,
	});
}

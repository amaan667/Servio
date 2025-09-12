import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

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
	source: 'qr';
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
			const thirtyMinutesAgoISO = new Date(Date.now() - 30 * 60 * 1000).toISOString();

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
				// Only live orders from the last 30 minutes
				.gte('created_at', thirtyMinutesAgoISO)
				// Active statuses per requirement
				.in('order_status', ['PLACED', 'IN_PREP', 'READY', 'SERVING', 'SERVED', 'COMPLETED'])
				.order('created_at', { ascending: false });

			if (error) throw error;
			
			// Get table labels for each order using table_number
			const ordersWithTableLabels = await Promise.all(
				(data || []).map(async (order: any) => {
					let tableLabel = null;
					if (order.table_number) {
						const { data: tableData } = await supabase
							.from('table_runtime_state')
							.select('label')
							.eq('venue_id', venueId)
							.eq('label', `Table ${order.table_number}`)
							.single();
						tableLabel = tableData?.label || `Table ${order.table_number}`;
					}
					
					return {
						...order,
						table_label: tableLabel,
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
			const thirtyMinutesAgoISO = new Date(Date.now() - 30 * 60 * 1000).toISOString();

			const { data, error } = await supabase
				.from('orders')
				.select('order_status, source, created_at')
				.eq('venue_id', venueId)
				.eq('source', 'qr')
				.gte('created_at', thirtyMinutesAgoISO)
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

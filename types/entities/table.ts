/**
 * Table Entity Types
 */

export type TableStatus = 
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'MAINTENANCE';

export interface Table {
  id: string;
  venue_id: string;
  label: string;
  area: string;
  capacity: number;
  status: TableStatus;
  position?: number;
  qr_code_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTableRequest {
  venueId: string;
  label: string;
  area: string;
  capacity: number;
  status?: TableStatus;
  position?: number;
}

export interface UpdateTableRequest {
  tableId: string;
  venueId: string;
  updates: {
    label?: string;
    area?: string;
    capacity?: number;
    status?: TableStatus;
    position?: number;
  };
}

export interface TableSession {
  id: string;
  venue_id: string;
  table_id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  status: 'OPEN' | 'CLOSED';
  started_at: string;
  closed_at?: string;
  total_amount: number;
}


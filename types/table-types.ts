// Table management types

export interface TableWithState {
  id: string;
  venue_id: string;
  table_number?: string;
  label?: string;
  seat_count: number;
  status?: string;
  qr_code_url?: string;
  created_at?: string;
  updated_at?: string;
  requiresConfirmation?: boolean;
  mergeScenario?: "simple" | "both_active" | "split_order" | "transfer";
  current_session_id?: string;
  merged_with_table_id?: string;
}

export interface MergeResult {
  success: boolean;
  message?: string;
  error?: string;
  requiresConfirmation?: boolean;
  mergedTableId?: string;
}

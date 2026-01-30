-- Address Supabase linter: unindexed foreign keys + unused indexes.
-- Keeps performance indexes (idx_tables_venue_id, idx_table_sessions_venue_status_closed,
-- idx_reservations_venue_status, idx_orders_venue_created_status, idx_venues_venue_id).

-- ========== Unindexed foreign keys (add covering indexes) ==========
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_id
  ON public.ai_chat_messages (conversation_id);

CREATE INDEX IF NOT EXISTS idx_bill_splits_counter_session_id
  ON public.bill_splits (counter_session_id);

CREATE INDEX IF NOT EXISTS idx_kds_station_categories_station_id
  ON public.kds_station_categories (station_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_kds_station_id
  ON public.menu_items (kds_station_id);

CREATE INDEX IF NOT EXISTS idx_option_choices_option_id
  ON public.option_choices (option_id);

CREATE INDEX IF NOT EXISTS idx_user_venue_roles_organization_id
  ON public.user_venue_roles (organization_id);

CREATE INDEX IF NOT EXISTS idx_venues_organization_id
  ON public.venues (organization_id);

CREATE INDEX IF NOT EXISTS idx_venues_owner_user_id
  ON public.venues (owner_user_id);

-- ========== Unused indexes (drop; keep performance indexes above) ==========
DROP INDEX IF EXISTS public.idx_ai_automations_created_by;
DROP INDEX IF EXISTS public.idx_ai_user_preferences_user_id;
DROP INDEX IF EXISTS public.idx_counter_sessions_server_id;
DROP INDEX IF EXISTS public.idx_feedback_responses_question_id;
DROP INDEX IF EXISTS public.idx_menu_upload_logs_uploaded_by;
DROP INDEX IF EXISTS public.idx_ml_category_feedback_user_id;
DROP INDEX IF EXISTS public.idx_ml_category_feedback_venue_id;
DROP INDEX IF EXISTS public.idx_ml_match_feedback_pdf_item_id;
DROP INDEX IF EXISTS public.idx_ml_match_feedback_url_item_id;
DROP INDEX IF EXISTS public.idx_ml_match_feedback_user_id;
DROP INDEX IF EXISTS public.idx_ml_match_feedback_venue_id;
DROP INDEX IF EXISTS public.idx_order_bill_splits_bill_split_id;
DROP INDEX IF EXISTS public.idx_orders_paid_by_user_id;
DROP INDEX IF EXISTS public.idx_pending_invitations_invited_by;
DROP INDEX IF EXISTS public.idx_pending_subscriptions_created_by_user_id;
DROP INDEX IF EXISTS public.idx_service_charges_applied_by;
DROP INDEX IF EXISTS public.idx_service_charges_counter_session_id;
DROP INDEX IF EXISTS public.idx_service_charges_table_session_id;
DROP INDEX IF EXISTS public.idx_service_charges_venue_id;
DROP INDEX IF EXISTS public.idx_staff_invitations_accepted_by;
DROP INDEX IF EXISTS public.idx_staff_invitations_invited_by;
DROP INDEX IF EXISTS public.idx_staff_invitations_organization_id;
DROP INDEX IF EXISTS public.idx_staff_invitations_user_id;
DROP INDEX IF EXISTS public.idx_staff_shifts_staff_id;
DROP INDEX IF EXISTS public.idx_stock_ledger_created_by;
DROP INDEX IF EXISTS public.idx_stock_ledgers_created_by;
DROP INDEX IF EXISTS public.idx_table_deletion_logs_triggered_by;
DROP INDEX IF EXISTS public.idx_table_reset_logs_triggered_by;
DROP INDEX IF EXISTS public.idx_table_sessions_merged_with_table_id;
DROP INDEX IF EXISTS public.idx_table_sessions_server_id;
DROP INDEX IF EXISTS public.idx_tables_merged_with_table_id;
DROP INDEX IF EXISTS public.idx_venue_activity_log_organization_id;
DROP INDEX IF EXISTS public.idx_waiting_list_table_id;

-- No primary key (linter): public.orders_backup_before_duplicate_fix, orders_backup_before_cleanup.
-- Backup tables; add PK only if you have a unique column (e.g. id). Example (run manually if applicable):
-- ALTER TABLE public.orders_backup_before_duplicate_fix ADD PRIMARY KEY (id);
-- ALTER TABLE public.orders_backup_before_cleanup ADD PRIMARY KEY (id);

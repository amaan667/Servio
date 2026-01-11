/**
 * Database Types - Auto-generated type definitions for all database tables
 * This provides type-safe access to database rows and eliminates the need for 'as any'
 */

// ========================================
// CORE TABLES
// ========================================

export interface VenueRow {

}

export interface UserRow {

}

export interface UserVenueRoleRow {

  permissions: Record<string, boolean>;
}

// ========================================
// TABLE & SESSION MANAGEMENT
// ========================================

export interface TableRow {

}

export interface TableSessionRow {

}

export interface CounterSessionRow {

}

export interface ReservationRow {

}

// ========================================
// ORDER MANAGEMENT
// ========================================

export interface OrderRow {

}

export interface OrderItem {

}

export interface OrderItemModifier {

}

// ========================================
// MENU MANAGEMENT
// ========================================

export interface MenuCategoryRow {

}

export interface MenuItemRow {

}

export interface MenuItemModifierRow {

}

export interface MenuDesignRow {

}

// ========================================
// STAFF & INVITATIONS
// ========================================

export interface StaffInvitationRow {

  permissions: Record<string, boolean>;

}

// ========================================
// INVENTORY
// ========================================

export interface IngredientRow {

}

export interface InventoryLogRow {

}

// ========================================
// KDS (Kitchen Display System)
// ========================================

export interface KDSStationRow {

}

export interface KDSTicketRow {

}

export interface KDSTicketItem {

}

// ========================================
// PAYMENTS
// ========================================

export interface PaymentRow {

}

export interface BillSplitRow {

}

export interface BillSplitDetail {

}

// ========================================
// FEEDBACK
// ========================================

export interface FeedbackRow {

}

export interface FeedbackQuestionRow {

}

// ========================================
// ANALYTICS
// ========================================

export interface AnalyticsEventRow {

  event_data: Record<string, unknown>;

}

// ========================================
// AI ASSISTANT
// ========================================

export interface AIChatConversationRow {

}

export interface AIChatMessageRow {

  tool_params: Record<string, unknown> | null;
  execution_result: Record<string, unknown> | null;

  undo_data: Record<string, unknown> | null;
}

export interface AIActionAuditRow {

  params: Record<string, unknown>;

  result: Record<string, unknown> | null;

}

// ========================================
// TYPE HELPERS
// ========================================

export type Role = "owner" | "manager" | "staff" | "server" | "kitchen";
export type OrderStatus = "pending" | "in_prep" | "ready" | "served" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "refunded" | "partial";
export type TableStatus = "available" | "occupied" | "reserved" | "inactive";
export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show";

// ========================================
// JOINED/EXTENDED TYPES
// ========================================

export interface OrderWithTable extends OrderRow {
  tables: Pick<TableRow, "label"> | null;
}

export interface OrderWithItems extends OrderRow {

}

export interface TableWithSession extends TableRow {

}

export interface ReservationWithTable extends ReservationRow {
  tables: Pick<TableRow, "label"> | null;
}

// ========================================
// API RESPONSE TYPES
// ========================================

export interface ApiResponse<T = unknown> {

}

export interface PaginatedResponse<T> {

  };
}

// ========================================
// DATABASE HELPER TYPES
// ========================================

export type InsertRow<T> = Omit<T, "id" | "created_at" | "updated_at">;
export type UpdateRow<T> = Partial<Omit<T, "id" | "created_at">>;

// ========================================
// SUPABASE DATABASE TYPE
// ========================================

/**
 * Main Database type for Supabase client
 * This matches the structure expected by Supabase's generated types
 */
export interface Database {

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };

      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

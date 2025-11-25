import { errorToContext } from "@/lib/utils/error-to-context";

import { useState } from "react";
import { logger } from "@/lib/logger";

export interface CreateTableParams {
  venue_id: string;
  label: string;
  seat_count?: number;
  qr_version?: number;
}

export interface UpdateTableParams {
  id: string;
  label?: string;
  seat_count?: number;
  is_active?: boolean;
  qr_version?: number;
}

export function useTableManagement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTable = async (params: CreateTableParams) => {
    try {
      console.log("[TABLE HOOK] 🎯 createTable called:", params);
      setLoading(true);
      setError(null);

      const { apiClient } = await import("@/lib/api-client");
      console.log("[TABLE HOOK] 📤 POST /api/tables:", params);
      const response = await apiClient.post("/api/tables", params);
      console.log("[TABLE HOOK] 📥 Response:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });
      
      const data = await response.json();
      console.log("[TABLE HOOK] Response data:", data);

      if (!response.ok) {
        console.log("[TABLE HOOK] ❌ Response not OK:", data);
        const errorMessage = data.error || "Failed to create table";
        const errorDetails = data.details || "";
        const errorCode = data.code || "";

        // Create a more detailed error object
        const error = new Error(errorMessage);
        (error as unknown as Record<string, unknown>).details = errorDetails;
        (error as unknown as Record<string, unknown>).code = errorCode;

        throw error;
      }

      console.log("[TABLE HOOK] ✅ Table created successfully:", data.table);
      return data.table;
    } catch (_err) {
      logger.error("[TABLE MANAGEMENT HOOK] Error creating table:", errorToContext(_err));
      const errorMessage = _err instanceof Error ? _err.message : "Failed to create table";
      setError(errorMessage);
      throw _err;
    } finally {
      setLoading(false);
    }
  };

  const updateTable = async (params: UpdateTableParams) => {
    try {
      setLoading(true);
      setError(null);

      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.put(`/api/tables/${params.id}`, {
        label: params.label,
        seat_count: params.seat_count,
        is_active: params.is_active,
        qr_version: params.qr_version,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update table");
      }

      return data.table;
    } catch (_err) {
      logger.error("[TABLE MANAGEMENT HOOK] Error updating table:", errorToContext(_err));
      const errorMessage = _err instanceof Error ? _err.message : "Failed to update table";
      setError(errorMessage);
      throw _err;
    } finally {
      setLoading(false);
    }
  };

  const deleteTable = async (tableId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.delete(`/api/tables/${tableId}`);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete table");
      }

      return data;
    } catch (_err) {
      logger.error("[TABLE MANAGEMENT HOOK] Error deleting table:", errorToContext(_err));
      const errorMessage = _err instanceof Error ? _err.message : "Failed to delete table";
      setError(errorMessage);
      throw _err;
    } finally {
      setLoading(false);
    }
  };

  const reissueQR = async (tableId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.post(`/api/tables/${tableId}/reissue-qr`, {
        /* Empty */
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reissue QR");
      }

      return data.table;
    } catch (_err) {
      logger.error("[TABLE MANAGEMENT HOOK] Error reissuing QR:", errorToContext(_err));
      const errorMessage = _err instanceof Error ? _err.message : "Failed to reissue QR";
      setError(errorMessage);
      throw _err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createTable,
    updateTable,
    deleteTable,
    reissueQR,
  };
}

import { errorToContext } from "@/lib/utils/error-to-context";

import { useState } from "react";

export interface CreateTableParams {

}

export interface UpdateTableParams {

}

export function useTableManagement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTable = async (params: CreateTableParams) => {
    try {
      setLoading(true);
      setError(null);

      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.post("/api/tables", params);
      const data = await response.json();

      if (!response.ok) {
        // Extract error message from standardized API response format
        let errorMessage = "Failed to create table";

        // Priority 1: Check for data.error.message (standard format)
        if (data.error && typeof data.error === "object" && "message" in data.error) {
          errorMessage = String(data.error.message);
        }
        // Priority 2: Check if data.error is a string
        else if (typeof data.error === "string" && data.error) {
          errorMessage = data.error;
        }
        // Priority 3: Check for data.message
        else if (data.message && typeof data.message === "string") {
          errorMessage = data.message;
        }
        // Priority 4: If data.error is an object without message, try to extract useful info
        else if (data.error && typeof data.error === "object") {
          errorMessage = JSON.stringify(data.error);
        }

        const errorDetails = data.error?.details || "";
        const errorCode = data.error?.code || "";

        const error = new Error(errorMessage);
        (error as unknown as Record<string, unknown>).details = errorDetails;
        (error as unknown as Record<string, unknown>).code = errorCode;

        throw error;
      }

      return data.table;
    } catch (_err) {
      );
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update table");
      }

      return data.table;
    } catch (_err) {
      );
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
      );
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reissue QR");
      }

      return data.table;
    } catch (_err) {
      );
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

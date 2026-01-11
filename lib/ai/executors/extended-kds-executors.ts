// Servio AI Assistant - Extended KDS Executors

import { AIExecutionResult, AIPreviewDiff } from "@/types/ai-assistant";
import {
  getStationTickets,
  bulkUpdateTickets,
  getOverdueKDSTickets,
  getStationPrepTimes,
} from "../tools/extended-kds-tools";

/**
 * Execute station tickets query
 */
export async function executeKDSGetStationTickets(
  params: { stationName: string },
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getStationTickets(venueId, params.stationName);

  return {
    success: true,
    toolName: "kds.get_station_tickets",
    result: {
      station: result.station,
      tickets: result.tickets,
      count: result.count,
      summary: result.summary,
    },
    auditId: "",
  };
}

/**
 * Execute bulk ticket status update
 */
export async function executeKDSBulkUpdate(
  params: { fromStatus: string; toStatus: string; stationName?: string },
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  if (preview) {
    return {
      toolName: "kds.bulk_update",
      before: [],
      after: [],
      impact: {
        itemsAffected: 0,
        description: `Will update all ${params.fromStatus} tickets to ${params.toStatus}${params.stationName ? ` at ${params.stationName}` : ""}`,
      },
    };
  }

  const result = await bulkUpdateTickets(
    venueId,
    params.fromStatus,
    params.toStatus,
    params.stationName
  );

  return {
    success: true,
    toolName: "kds.bulk_update",
    result: {
      updatedCount: result.updatedCount,
      status: result.status,
      message: result.message,
    },
    auditId: "",
  };
}

/**
 * Execute overdue KDS tickets query
 */
export async function executeKDSGetOverdueExtended(
  params: { thresholdMinutes?: number },
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getOverdueKDSTickets(venueId, params.thresholdMinutes);

  return {
    success: true,
    toolName: "kds.get_overdue_extended",
    result: {
      tickets: result.tickets,
      count: result.count,
      summary: result.summary,
    },
    auditId: "",
  };
}

/**
 * Execute station prep times query
 */
export async function executeKDSGetPrepTimes(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getStationPrepTimes(venueId);

  return {
    success: true,
    toolName: "kds.get_prep_times",
    result: {
      stations: result.stations,
      summary: result.summary,
    },
    auditId: "",
  };
}

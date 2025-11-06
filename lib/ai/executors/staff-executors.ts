// Servio AI Assistant - Staff Management Executors

import { AIExecutionResult, AIPreviewDiff } from "@/types/ai-assistant";
import {
  getAllStaff,
  inviteStaffMember,
  getStaffRoles,
  getTodayStaffSchedule,
  getStaffPerformance,
} from "../tools/staff-management-tools";

/**
 * Execute staff list query
 */
export async function executeStaffList(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getAllStaff(venueId);

  return {
    success: true,
    toolName: "staff.list",
    result: {
      staff: result.staff,
      count: result.count,
      summary: result.summary,
    },
    auditId: "",
  };
}

/**
 * Execute staff invitation
 */
export async function executeStaffInvite(
  params: { email: string; role: "manager" | "server"; name?: string },
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  if (preview) {
    return {
      toolName: "staff.invite",
      before: [],
      after: [{ email: params.email, role: params.role }],
      impact: {
        itemsAffected: 1,
        description: `Will invite ${params.email} as ${params.role}`,
      },
    };
  }

  const result = await inviteStaffMember(venueId, params.email, params.role, params.name);

  return {
    success: true,
    toolName: "staff.invite",
    result: {
      inviteId: result.inviteId,
      email: result.email,
      role: result.role,
      message: result.message,
    },
    auditId: "",
  };
}

/**
 * Execute staff roles query
 */
export async function executeStaffGetRoles(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getStaffRoles(venueId);

  return {
    success: true,
    toolName: "staff.get_roles",
    result: {
      roles: result.roles,
      summary: result.summary,
    },
    auditId: "",
  };
}

/**
 * Execute today's schedule query
 */
export async function executeStaffGetSchedule(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getTodayStaffSchedule(venueId);

  return {
    success: true,
    toolName: "staff.get_schedule",
    result: {
      staff: result.staff,
      count: result.count,
      summary: result.summary,
    },
    auditId: "",
  };
}

/**
 * Execute staff performance query
 */
export async function executeStaffGetPerformance(
  params: { timeRange?: "week" | "month" },
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getStaffPerformance(venueId, params.timeRange);

  return {
    success: true,
    toolName: "staff.get_performance",
    result: {
      staff: result.staff,
      summary: result.summary,
    },
    auditId: "",
  };
}

import { createAdminClient } from "@/lib/supabase";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, start_time, end_time, area } = body as {
      id?: string;
      start_time?: string;
      end_time?: string;
      area?: string;
    };

    if (!id) return apiErrors.badRequest("id required");

    const updates: Record<string, string | null> = {};
    if (start_time !== undefined) updates.start_time = start_time;
    if (end_time !== undefined) updates.end_time = end_time;
    if (area !== undefined) updates.area = area || null;

    if (Object.keys(updates).length === 0) {
      return apiErrors.badRequest("No fields to update");
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("staff_shifts")
      .update(updates)
      .eq("id", id)
      .select("*");

    if (error) return apiErrors.badRequest(error.message);
    return success({ data: data || [] });
  } catch (_error) {
    return apiErrors.internal(_error instanceof Error ? _error.message : "Internal server error");
  }
}

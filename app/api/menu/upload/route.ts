import { createClient, createAdminClient } from "@/lib/supabase";
import { apiErrors } from "@/lib/api/standard-response";
import { createUnifiedHandler } from "@/lib/api/unified-handler";

export const runtime = "nodejs";

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * POST: Upload menu file for a venue
 */
export const POST = createUnifiedHandler(
  async (req, context) => {
    const { venueId } = context;

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const formVenueId = (form.get("venue_id") as string) || (form.get("venueId") as string) || "";

    if (formVenueId && formVenueId !== venueId) {
      return apiErrors.forbidden("Venue ID mismatch");
    }

    if (!file) {
      return apiErrors.badRequest("file is required");
    }

    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Ensure bucket exists
    try {
      const { data: buckets } = await adminSupabase.storage.listBuckets();
      const has = (buckets || []).some((b: { name: string }) => b.name === "menus");
      if (!has) {
        await adminSupabase.storage.createBucket("menus", { public: false });
      }
    } catch (_e) {
      /* Ignore */
    }

    const arrayBuf = await file.arrayBuffer();
    const hash = await sha256(arrayBuf);

    const originalName = file.name || `${hash}`;
    const lower = originalName.toLowerCase();
    const ext = lower.includes(".") ? lower.substring(lower.lastIndexOf(".")) : ".pdf";
    const safeExt = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".heic"].includes(ext)
      ? ext
      : ".pdf";

    const contentTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".webp": "image/webp",
      ".heic": "image/heic",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
    };
    const contentType = contentTypes[safeExt] || "application/octet-stream";
    const path = `${venueId}/${hash}${safeExt}`;

    // Check existing
    const { data: existing } = await supabase
      .from("menu_uploads")
      .select("id, status")
      .eq("venue_id", venueId)
      .eq("sha256", hash)
      .maybeSingle();

    let uploadId: string | null = existing?.id ?? null;

    if (!existing) {
      const { error: upErr } = await adminSupabase.storage
        .from("menus")
        .upload(path, new Blob([arrayBuf]), { upsert: true, contentType });

      if (upErr) {
        throw new Error(`Storage upload failed: ${upErr.message}`);
      }

      const { data: ins, error: insErr } = await supabase
        .from("menu_uploads")
        .insert({ venue_id: venueId, filename: path, sha256: hash, status: "uploaded" })
        .select("id")
        .maybeSingle();

      if (insErr) {
        throw new Error(`Database record creation failed: ${insErr.message}`);
      }
      uploadId = ins?.id ?? null;
    }

    return { ok: true, upload_id: uploadId, sha256: hash, path };
  },
  {
    requireVenueAccess: true,
    venueIdSource: "auto",
  }
);

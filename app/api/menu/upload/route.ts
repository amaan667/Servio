import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Upload menu file for a venue
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only upload menus for venues they have access to.
 * Storage operations use admin client as they require service role permissions.
 */
export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    // STEP 2: Get venueId from context (already verified by withUnifiedAuth)
    const venueId = context.venueId;
    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // STEP 3: Parse form data
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const formVenueId = (form.get("venue_id") as string) || (form.get("venueId") as string) || "";

    // Verify venueId from form matches context (double-check for security)
    if (formVenueId && formVenueId !== venueId) {
      
      return apiErrors.forbidden("Venue ID mismatch");
    }

    if (!file) {
      return apiErrors.badRequest("file is required");
    }

    // Use authenticated client for database operations (respects RLS)
    const supabase = await createClient();

    // SECURITY NOTE: Storage operations require admin client for bucket management
    // This is safe because:
    // 1. Venue access is already verified by withUnifiedAuth
    // 2. File path includes venueId: `${venueId}/${hash}${ext}`
    // 3. Database operations use authenticated client with RLS
    const adminSupabase = createAdminClient();

    // Ensure table + RLS exists (idempotent)
    try {
      // Use a lightweight insert-select approach to avoid ts complaints; Supabase JS doesn't support arbitrary SQL without a function.
      // Expect this to fail harmlessly if a security defers creation; DDL should be applied via scripts as the primary path.
      await supabase.from("menu_uploads").select("id").limit(1);
    } catch {
      
    }
    // Note: primary table creation should be done via scripts/menu-upload-schema.sql
    // Included here as documentation for desired RLS settings:
    /*
    create extension if not exists pgcrypto;
    create table if not exists public.menu_uploads (
      id uuid primary key default gen_random_uuid(),
      venue_id text not null references public.venues(venue_id) on delete cascade,
      filename text not null,
      sha256 text not null,
      pages int,
      status text default 'uploaded',
      ocr_used boolean default false,
      raw_text text,
      parsed_json jsonb,
      error text,
      created_at timestamptz default now(),
      unique (venue_id, sha256)
    );
    alter table public.menu_uploads enable row level security;
    */

    // Ensure bucket exists (requires admin client for bucket management)
    try {
      const { data: buckets } = await adminSupabase.storage.listBuckets();
      const has = (buckets || []).some((b: unknown) => (b as { name?: string }).name === "menus");
      if (!has) {
        await adminSupabase.storage.createBucket("menus", { public: false });
      }
    } catch {
      // Silent error handling - bucket might already exist
    }

    const arrayBuf = await file.arrayBuffer();
    const hash = await sha256(arrayBuf);
    // Preserve original extension for routing (pdf vs images vs text)
    const originalName = file.name || `${hash}`;
    const lower = originalName.toLowerCase();
    const ext = lower.includes(".") ? lower.substring(lower.lastIndexOf(".")) : ".pdf";
    const safeExt = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".heic"].includes(ext)
      ? ext

    const path = `${venueId}/${hash}${safeExt}`;

    // Check cache using authenticated client (RLS ensures venue isolation)
    const { data: existing, error: selErr } = await supabase
      .from("menu_uploads")
      .select("id, status")
      .eq("venue_id", venueId) // Explicit venue check (RLS also enforces this)
      .eq("sha256", hash)
      .maybeSingle();
    if (selErr) {
      
    }
    let uploadId: string | null = existing?.id ?? null;
    if (!existing) {
      // Storage upload requires admin client (service role needed)
      const { error: upErr } = await adminSupabase.storage
        .from("menus")
        .upload(path, new Blob([arrayBuf]), { upsert: true, contentType });
      if (upErr) {
        
        return apiErrors.badRequest(upErr.message);
      }

      // Database insert using authenticated client (RLS ensures venue isolation)
      const { data: ins, error: insErr } = await supabase
        .from("menu_uploads")
        .insert({ venue_id: venueId, filename: path, sha256: hash, status: "uploaded" })
        .select("id")
        .maybeSingle();
      if (insErr) {
        
        return apiErrors.badRequest(insErr.message);
      }
      uploadId = ins?.id ?? null;
    }

    

    return success({ ok: true, upload_id: uploadId, sha256: hash, path });
  } catch (error) {

    return apiErrors.internal("Upload failed", error instanceof Error ? error.message : undefined);
  }

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { getAuthUserForAPI } from "@/lib/auth/server";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return apiErrors.unauthorized("Unauthorized");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const itemId = formData.get("itemId") as string | null;

    if (!file || !itemId) {
      return apiErrors.badRequest("file and itemId are required");
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabase();

    // Get the menu item to verify access and get venue_id
    const { data: menuItem, error: menuItemError } = await supabase
      .from("menu_items")
      .select("venue_id, name")
      .eq("id", itemId)
      .single();

    if (menuItemError || !menuItem) {
      return apiErrors.notFound("Menu item not found");
    }

    // Verify venue access
    const { data: venueAccess } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", menuItem.venue_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const { data: staffAccess } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", menuItem.venue_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!venueAccess && !staffAccess) {
      return apiErrors.forbidden("Forbidden");
    }

    // Ensure bucket exists
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const hasBucket = (buckets || []).some((b) => b.name === "menu-images");
      if (!hasBucket) {
        await supabase.storage.createBucket("menu-images", { public: true });
      }
    } catch (bucketError) {
      
    }

    // Get file extension
    const fileName = file.name || "image";
    const ext = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
    const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".heic"].includes(ext) ? ext : ".jpg";

    // Upload to storage
    const timestamp = Date.now();
    const path = `${menuItem.venue_id}/${itemId}-${timestamp}${safeExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("menu-images")
      .upload(path, arrayBuffer, {

    if (uploadError) {
      
      return apiErrors.internal("Failed to upload image");
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("menu-images").getPublicUrl(path);

    // Update menu item with new image URL
    const { error: updateError } = await supabase
      .from("menu_items")
      .update({ image_url: publicUrl })
      .eq("id", itemId);

    if (updateError) {
      
      return apiErrors.internal("Failed to update menu item");
    }

    return NextResponse.json({ imageUrl: publicUrl });
  } catch (error) {
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

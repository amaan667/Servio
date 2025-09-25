import { NextResponse } from "next/server";
import { parseMenuInChunks } from "@/lib/parseMenuFC";
import { normalizeForInsert } from "@/lib/normalizeMenu";
import { MenuPayload } from "@/lib/menuSchema";
import { createAdminClient } from "@/lib/supabase/server";
import { logInfo, logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Add better error handling for request parsing
    let requestBody;
    let rawBodyText = '';
    
    try {
      rawBodyText = await req.text();
      logInfo('[AUTH DEBUG] Raw request body preview:', rawBodyText.substring(0, 200));
      
      requestBody = JSON.parse(rawBodyText);
    } catch (parseError: any) {
      logError('[AUTH DEBUG] Failed to parse request JSON:', parseError);
      logError('[AUTH DEBUG] Raw request body:', rawBodyText);
      return NextResponse.json({ 
        ok: false, 
        error: `Invalid JSON in request body: ${parseError.message}` 
      }, { status: 400 });
    }

    const { venue_id, filename, text } = requestBody;
    
    if (!venue_id) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing venue_id' 
      }, { status: 400 });
    }

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing or invalid text' 
      }, { status: 400 });
    }

    logInfo('[AUTH DEBUG] Process-text API called with:', { venue_id, filename, textLength: text.length });
    logInfo('[AUTH DEBUG] Processing text menu for venue:', venue_id, 'length:', text.length);
    logInfo('[AUTH DEBUG] Text preview:', text.substring(0, 200));

    // Parse menu using function-calling with chunking
    let rawPayload;
    try {
      rawPayload = await parseMenuInChunks(text);
    } catch (parseError: any) {
      logError('[AUTH DEBUG] Menu parsing failed:', parseError);
      return NextResponse.json({ 
        ok: false, 
        error: `Menu parsing failed: ${parseError.message}` 
      }, { status: 500 });
    }

    logInfo('[AUTH DEBUG] Menu parsing completed successfully');

    // Normalize for database insertion
    let normalized;
    try {
      normalized = normalizeForInsert(rawPayload);
    } catch (normalizeError: any) {
      logError('[AUTH DEBUG] Normalization failed:', normalizeError);
      return NextResponse.json({ 
        ok: false, 
        error: `Normalization failed: ${normalizeError.message}` 
      }, { status: 500 });
    }

    logInfo('[AUTH DEBUG] Normalized items:', normalized.items.length);

    // Validate against schema
    let validated;
    try {
      validated = MenuPayload.parse(normalized);
    } catch (validationError: any) {
      logError('[AUTH DEBUG] Schema validation failed:', validationError);
      return NextResponse.json({ 
        ok: false, 
        error: `Schema validation failed: ${validationError.message}` 
      }, { status: 500 });
    }

    logInfo('[AUTH DEBUG] Schema validation successful');

    // Use UPSERT instead of individual INSERTs
    const itemsToUpsert = validated.items.map(item => ({
      venue_id: venue_id,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      available: item.available
    }));

    logInfo('[DB] about_to_insert', itemsToUpsert.length);

    const supabase = await createAdminClient();

    // Avoid relying on ON CONFLICT; filter existing names first
    const { data: existing } = await supabase
      .from('menu_items')
      .select('name')
      .eq('venue_id', venue_id);
    const existingNames = new Set((existing || []).map((r:any)=>String(r.name||'').toLowerCase()));
    const toInsert = itemsToUpsert.filter(it=>!existingNames.has(String(it.name).toLowerCase()));

    const { data: upsertedItems, error: insertErr } = await supabase
      .from('menu_items')
      .insert(toInsert)
      .select('id, name, price');

    if (insertErr) {
      logError('[AUTH DEBUG] INSERT failed:', insertErr);
      return NextResponse.json({ ok:false, error:`Database insertion failed: ${insertErr.message}` }, { status:500 });
    }

    const inserted = upsertedItems?.length || 0;
    logInfo('[AUTH DEBUG] Final result - Inserted:', inserted, 'Total processed:', validated.items.length);

    return NextResponse.json({
      ok: true,
      counts: { inserted, total: validated.items.length },
      items: upsertedItems
    });

  } catch (error: any) {
    logError('[AUTH DEBUG] Text processing error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Text processing failed: ${error.message}` 
    }, { status: 500 });
  }
}

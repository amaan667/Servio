import { NextResponse } from "next/server";
import { parseMenuInChunks } from "@/lib/parseMenuFC";
import { normalizeForInsert } from "@/lib/normalizeMenu";
import { MenuPayload } from "@/lib/menuSchema";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Add better error handling for request parsing
    let requestBody;
    let rawBodyText = '';
    
    try {
      rawBodyText = await req.text();
      
      requestBody = JSON.parse(rawBodyText);
    } catch (parseError: any) {
      console.error('[AUTH DEBUG] Failed to parse request JSON:', parseError);
      console.error('[AUTH DEBUG] Raw request body:', rawBodyText);
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


    // Parse menu using function-calling with chunking
    let rawPayload;
    try {
      rawPayload = await parseMenuInChunks(text);
    } catch (parseError: any) {
      console.error('[AUTH DEBUG] Menu parsing failed:', parseError);
      return NextResponse.json({ 
        ok: false, 
        error: `Menu parsing failed: ${parseError.message}` 
      }, { status: 500 });
    }


    // Normalize for database insertion
    let normalized;
    try {
      normalized = normalizeForInsert(rawPayload);
    } catch (normalizeError: any) {
      console.error('[AUTH DEBUG] Normalization failed:', normalizeError);
      return NextResponse.json({ 
        ok: false, 
        error: `Normalization failed: ${normalizeError.message}` 
      }, { status: 500 });
    }


    // Validate against schema
    let validated;
    try {
      validated = MenuPayload.parse(normalized);
    } catch (validationError: any) {
      console.error('[AUTH DEBUG] Schema validation failed:', validationError);
      return NextResponse.json({ 
        ok: false, 
        error: `Schema validation failed: ${validationError.message}` 
      }, { status: 500 });
    }


    // Use UPSERT instead of individual INSERTs
    const itemsToUpsert = validated.items.map(item => ({
      venue_id: venue_id,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      is_available: item.available
    }));


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
      console.error('[AUTH DEBUG] INSERT failed:', insertErr);
      return NextResponse.json({ ok:false, error:`Database insertion failed: ${insertErr.message}` }, { status:500 });
    }

    const inserted = upsertedItems?.length || 0;

    return NextResponse.json({
      ok: true,
      counts: { inserted, total: validated.items.length },
      items: upsertedItems
    });

  } catch (error: any) {
    console.error('[AUTH DEBUG] Text processing error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Text processing failed: ${error.message}` 
    }, { status: 500 });
  }
}

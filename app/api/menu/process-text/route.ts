import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseMenuInChunks } from '@/lib/parseMenuFC';
import { normalizeForInsert } from '@/lib/normalizeMenu';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supa = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { venue_id, filename, text } = await request.json();

    if (!venue_id || !text) {
      return NextResponse.json({ ok: false, error: 'venue_id and text are required' }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Process-text API called with:', { venue_id, filename, textLength: text.length });
    console.log('[AUTH DEBUG] Processing text menu for venue:', venue_id, 'length:', text.length);
    console.log('[AUTH DEBUG] Text preview:', text.substring(0, 200));

    if (text.length < 200) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Text is too short. Please provide a longer menu text.' 
      }, { status: 400 });
    }

    // Parse menu using function-calling with chunking
    let payload;
    try {
      payload = await parseMenuInChunks(text);
      console.log('[AUTH DEBUG] Menu parsing completed successfully');
    } catch (parseError) {
      console.error('[AUTH DEBUG] Menu parsing failed:', parseError);
      return NextResponse.json({ 
        ok: false, 
        error: `Menu parsing failed: ${parseError.message}` 
      }, { status: 500 });
    }

    // Normalize for database insertion
    const normalized = normalizeForInsert(payload);
    console.log('[AUTH DEBUG] Normalized items:', normalized.items.length);

    // Insert items in batches of 50
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < normalized.items.length; i += 50) {
      const batch = normalized.items.slice(i, i + 50);
      
      for (const item of batch) {
        // Check if item already exists
        const { data: existing } = await supa
          .from('menu_items')
          .select('id')
          .eq('venue_id', venue_id)
          .eq('name', item.name)
          .eq('price', item.price)
          .maybeSingle();

        if (existing) {
          console.log('[AUTH DEBUG] Skipping existing item:', item.name);
          skipped++;
          continue;
        }

        // Insert new item
        const { data: insertedItem, error: insertErr } = await supa
          .from('menu_items')
          .insert({
            venue_id,
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category,
            available: item.available
          })
          .select()
          .single();

        if (insertErr) {
          console.error('[AUTH DEBUG] Failed to insert item:', insertErr.message);
          console.error('[AUTH DEBUG] Item that failed:', item);
          skipped++;
        } else {
          console.log('[AUTH DEBUG] Successfully inserted item:', insertedItem);
          inserted++;
        }
      }
    }

    console.log('[AUTH DEBUG] Final result - Inserted:', inserted, 'Skipped:', skipped, 'Total processed:', normalized.items.length);

    return NextResponse.json({
      ok: true,
      counts: { inserted, skipped },
      total: normalized.items.length
    });

  } catch (error) {
    console.error('[AUTH DEBUG] Text processing error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Text processing failed: ${error.message}` 
    }, { status: 500 });
  }
}

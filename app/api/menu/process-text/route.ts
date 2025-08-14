import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { venue_id, filename, text } = await req.json();

    console.log('[AUTH DEBUG] Process-text API called with:', { venue_id, filename, textLength: text?.length });

    // Validate input
    if (!venue_id || typeof venue_id !== 'string') {
      console.log('[AUTH DEBUG] Invalid venue_id:', venue_id);
      return NextResponse.json({ ok: false, error: 'venue_id is required' }, { status: 400 });
    }

    if (!text || typeof text !== 'string' || text.length < 200) {
      console.log('[AUTH DEBUG] Invalid text:', { textLength: text?.length, textType: typeof text });
      return NextResponse.json({ ok: false, error: 'text must be at least 200 characters' }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Processing text menu for venue:', venue_id, 'length:', text.length);
    console.log('[AUTH DEBUG] Text preview:', text.substring(0, 500));

    // Extract menu items using OpenAI with order preservation
    const prompt = `Extract menu items from this restaurant menu text. Return ONLY a valid JSON object with this exact schema:

{
  "items": [
    {
      "name": "string (max 80 chars)",
      "description": "string|null",
      "price": "number (GBP, no currency symbols)",
      "category": "string",
      "available": true
    }
  ]
}

Rules:
- Find food/drink items with prices
- Normalize currency to GBP numbers (strip £, $, € symbols)
- Infer categories from headings or item types
- Only include items with price > 0
- Name must be <= 80 characters
- Ignore headers, footers, "about us", allergy info, promotions
- Return valid JSON only
- Focus on actual menu items with prices

Menu Text:
${text.substring(0, 3000)}`;

    console.log('[AUTH DEBUG] Sending to OpenAI with prompt length:', prompt.length);
    console.log('[AUTH DEBUG] Prompt preview:', prompt.substring(0, 500));

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.log('[AUTH DEBUG] No content from OpenAI');
      return NextResponse.json({ ok: false, error: 'Failed to extract menu items' }, { status: 500 });
    }

    console.log('[AUTH DEBUG] FULL OpenAI response:', content);

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      console.error('[AUTH DEBUG] Failed to parse OpenAI response:', parseErr);
      console.error('[AUTH DEBUG] Raw OpenAI response:', content);
      return NextResponse.json({ ok: false, error: 'Invalid response format' }, { status: 500 });
    }

    const items = parsed.items || [];
    console.log('[AUTH DEBUG] Extracted', items.length, 'menu items');
    console.log('[AUTH DEBUG] Raw items from OpenAI:', JSON.stringify(items, null, 2));

    // Validate and normalize items
    const validItems = items
      .filter((item: any) => {
        const isValid = item.name && 
          typeof item.name === 'string' && 
          item.name.length <= 80 &&
          item.price && 
          typeof item.price === 'number' && 
          item.price > 0;
        
        if (!isValid) {
          console.log('[AUTH DEBUG] Filtered out invalid item:', item);
        }
        return isValid;
      })
      .map((item: any, index: number) => ({
        venue_id,
        name: item.name.trim(),
        description: item.description || null,
        price: Math.round(item.price * 100) / 100, // Round to 2 decimal places
        category: item.category || 'Uncategorized',
        available: true
      }));

    console.log('[AUTH DEBUG] Valid items after filtering:', validItems.length);
    console.log('[AUTH DEBUG] Items to insert:', validItems.map((item: any) => ({ name: item.name, category: item.category, price: item.price })));

    // Insert items in batches of 50
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < validItems.length; i += 50) {
      const batch = validItems.slice(i, i + 50);
      
      for (const item of batch) {
        // Check if item already exists
        const { data: existing } = await supa
          .from('menu_items')
          .select('id')
          .eq('venue_id', item.venue_id)
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
          .insert(item)
          .select()
          .single();

        if (insertErr) {
          console.error('[AUTH DEBUG] Failed to insert item:', insertErr);
          console.error('[AUTH DEBUG] Item that failed:', item);
          skipped++;
        } else {
          console.log('[AUTH DEBUG] Successfully inserted item:', insertedItem);
          inserted++;
        }
      }
    }

    console.log('[AUTH DEBUG] Final result - Inserted:', inserted, 'Skipped:', skipped);

    return NextResponse.json({
      ok: true,
      counts: { inserted, skipped },
      total: validItems.length
    });

  } catch (error) {
    console.error('[AUTH DEBUG] Process text error:', error);
    return NextResponse.json({ ok: false, error: 'Processing failed' }, { status: 500 });
  }
}

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

    // Validate input
    if (!venue_id || typeof venue_id !== 'string') {
      return NextResponse.json({ ok: false, error: 'venue_id is required' }, { status: 400 });
    }

    if (!text || typeof text !== 'string' || text.length < 200) {
      return NextResponse.json({ ok: false, error: 'text must be at least 200 characters' }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Processing text menu for venue:', venue_id, 'length:', text.length);

    // Extract menu items using OpenAI
    const prompt = `You are extracting a structured restaurant/cafe menu from OCR'd text. Return ONLY a valid JSON object with this exact schema:

{
  "items": [
    {
      "name": "string (max 80 chars)",
      "description": "string|null",
      "price": "number (GBP, no currency symbols)",
      "category": "string",
      "available": true
    }
  ],
  "categories": ["string", "..."]
}

Rules:
- Find food/drink items with prices
- Normalize currency to GBP numbers (strip £, $, € symbols)
- Infer categories from headings or item types
- Drop duplicates (keep first occurrence)
- Only include items with price > 0
- Name must be <= 80 characters
- Ignore headers, footers, "about us", allergy info, promotions
- Return valid JSON only

OCR Text (truncated):
${text.substring(0, 3000)}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ ok: false, error: 'Failed to extract menu items' }, { status: 500 });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      console.error('[AUTH DEBUG] Failed to parse OpenAI response:', parseErr);
      return NextResponse.json({ ok: false, error: 'Invalid response format' }, { status: 500 });
    }

    const items = parsed.items || [];
    console.log('[AUTH DEBUG] Extracted', items.length, 'menu items');

    // Validate and normalize items
    const validItems = items
      .filter((item: any) => 
        item.name && 
        typeof item.name === 'string' && 
        item.name.length <= 80 &&
        item.price && 
        typeof item.price === 'number' && 
        item.price > 0
      )
      .map((item: any) => ({
        venue_id,
        name: item.name.trim(),
        description: item.description || null,
        price: Math.round(item.price * 100) / 100, // Round to 2 decimal places
        category: item.category || 'Uncategorized',
        available: true
      }));

    console.log('[AUTH DEBUG] Valid items:', validItems.length);

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
          skipped++;
          continue;
        }

        // Insert new item
        const { error: insertErr } = await supa
          .from('menu_items')
          .insert(item);

        if (insertErr) {
          console.error('[AUTH DEBUG] Failed to insert item:', insertErr);
          skipped++;
        } else {
          inserted++;
        }
      }
    }

    console.log('[AUTH DEBUG] Inserted:', inserted, 'Skipped:', skipped);

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

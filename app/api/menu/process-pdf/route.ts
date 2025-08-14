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
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const venue_id = formData.get('venue_id') as string;

    console.log('[AUTH DEBUG] Process-pdf API called with:', { venue_id, filename: file?.name, fileSize: file?.size });

    if (!file || !venue_id) {
      console.log('[AUTH DEBUG] Missing file or venue_id');
      return NextResponse.json({ ok: false, error: 'File and venue_id are required' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      console.log('[AUTH DEBUG] Not a PDF file:', file.name);
      return NextResponse.json({ ok: false, error: 'File must be a PDF' }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Processing PDF file:', file.name, 'size:', file.size);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log('[AUTH DEBUG] PDF buffer size:', buffer.length);

    // Extract text using pdf-parse (dynamic import to avoid build issues)
    let text = '';
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      text = data.text;
      console.log('[AUTH DEBUG] Extracted text length:', text.length);
      console.log('[AUTH DEBUG] Text preview:', text.substring(0, 500));
    } catch (parseError) {
      console.error('[AUTH DEBUG] PDF parse error:', parseError);
      return NextResponse.json({ ok: false, error: 'Failed to parse PDF' }, { status: 500 });
    }

    if (text.length < 200) {
      console.log('[AUTH DEBUG] Text too short:', text.length);
      return NextResponse.json({ ok: false, error: 'Extracted text is too short (less than 200 characters)' }, { status: 400 });
    }

    // Extract menu items using OpenAI with order preservation
    const prompt = `You are extracting a structured restaurant/cafe menu from OCR'd text. Return ONLY a valid JSON object with this exact schema:

{
  "items": [
    {
      "name": "string (max 80 chars)",
      "description": "string|null",
      "price": "number (GBP, no currency symbols)",
      "category": "string",
      "available": true,
      "order_index": "number (position in menu, starting from 0)"
    }
  ],
  "categories": ["string", "..."]
}

Rules:
- Find food/drink items with prices
- Normalize currency to GBP numbers (strip £, $, € symbols)
- Infer categories from headings or item types
- Preserve the EXACT order from the original menu (drinks at bottom, etc.)
- Assign order_index based on position in the menu (0, 1, 2, etc.)
- Only include items with price > 0
- Name must be <= 80 characters
- Ignore headers, footers, "about us", allergy info, promotions
- Return valid JSON only

OCR Text (truncated):
${text.substring(0, 3000)}`;

    console.log('[AUTH DEBUG] Sending to OpenAI...');

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

    console.log('[AUTH DEBUG] OpenAI response:', content);

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      console.error('[AUTH DEBUG] Failed to parse OpenAI response:', parseErr);
      return NextResponse.json({ ok: false, error: 'Invalid response format' }, { status: 500 });
    }

    const items = parsed.items || [];
    console.log('[AUTH DEBUG] Extracted', items.length, 'menu items');

    // Validate and normalize items, preserving order
    const validItems = items
      .filter((item: any) => 
        item.name && 
        typeof item.name === 'string' && 
        item.name.length <= 80 &&
        item.price && 
        typeof item.price === 'number' && 
        item.price > 0
      )
      .map((item: any, index: number) => ({
        venue_id,
        name: item.name.trim(),
        description: item.description || null,
        price: Math.round(item.price * 100) / 100, // Round to 2 decimal places
        category: item.category || 'Uncategorized',
        available: true,
        order_index: item.order_index !== undefined ? item.order_index : index
      }))
      .sort((a: any, b: any) => a.order_index - b.order_index); // Sort by order_index

    console.log('[AUTH DEBUG] Valid items:', validItems.length);
    console.log('[AUTH DEBUG] Items with order:', validItems.map((item: any) => ({ name: item.name, order: item.order_index })));

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
    console.error('[AUTH DEBUG] Process PDF error:', error);
    return NextResponse.json({ ok: false, error: 'Processing failed' }, { status: 500 });
  }
}

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

    // Extract menu items using OpenAI with comprehensive extraction
    const prompt = `Extract ALL menu items from this restaurant menu text. Be thorough and extract every single food/drink item with a price. Return ONLY a valid JSON object with this exact schema:

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

CRITICAL RULES:
- Extract EVERY single menu item with a price - don't miss any
- Look for prices in various formats: £7.50, 7.50, £7, 7, etc.
- Normalize all prices to numbers (strip £, $, € symbols)
- Infer categories from section headers (STARTERS, MAIN COURSES, DESSERTS, DRINKS, etc.)
- Include items even if description is missing
- Only filter out items with no price or price = 0
- Be very thorough - extract items from all sections
- Preserve the exact item names and descriptions
- Don't skip items that seem incomplete - extract what you can

Menu Text:
${text}`;

    console.log('[AUTH DEBUG] Sending to OpenAI with prompt length:', prompt.length);
    console.log('[AUTH DEBUG] Full text length:', text.length);
    console.log('[AUTH DEBUG] Text preview (first 500 chars):', text.substring(0, 500));

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4000
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.log('[AUTH DEBUG] No content from OpenAI');
      return NextResponse.json({ ok: false, error: 'Failed to extract menu items' }, { status: 500 });
    }

    console.log('[AUTH DEBUG] OpenAI response length:', content.length);
    console.log('[AUTH DEBUG] OpenAI response preview:', content.substring(0, 500));

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      console.error('[AUTH DEBUG] Failed to parse OpenAI response:', parseErr);
      console.error('[AUTH DEBUG] Raw OpenAI response (first 1000 chars):', content.substring(0, 1000));
      
      // Try to fix common JSON issues
      try {
        // Remove trailing commas and fix common issues
        let fixedContent = content
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .replace(/([^"])\s*}\s*$/g, '$1}') // Fix missing closing braces
          .replace(/([^"])\s*]\s*$/g, '$1]'); // Fix missing closing brackets
        
        parsed = JSON.parse(fixedContent);
        console.log('[AUTH DEBUG] Successfully parsed after fixing JSON issues');
      } catch (fixErr) {
        console.error('[AUTH DEBUG] Failed to fix JSON:', fixErr);
        return NextResponse.json({ ok: false, error: 'Invalid response format from AI' }, { status: 500 });
      }
    }

    const items = parsed.items || [];
    console.log('[AUTH DEBUG] Extracted', items.length, 'menu items from OpenAI');

    // More lenient validation - only filter out completely invalid items
    const validItems = items
      .filter((item: any) => {
        // Check if item has basic required fields
        const hasName = item.name && typeof item.name === 'string' && item.name.trim().length > 0;
        const hasPrice = item.price !== undefined && item.price !== null;
        
        if (!hasName) {
          return false;
        }
        
        if (!hasPrice) {
          return false;
        }
        
        // Convert price to number if it's a string
        let numericPrice = item.price;
        if (typeof item.price === 'string') {
          numericPrice = parseFloat(item.price.replace(/[£$€,]/g, ''));
        }
        
        if (isNaN(numericPrice) || numericPrice <= 0) {
          return false;
        }
        
        // Check name length
        if (item.name.length > 80) {
          return false;
        }
        
        return true;
      })
      .map((item: any, index: number) => {
        // Convert price to number if it's a string
        let numericPrice = item.price;
        if (typeof item.price === 'string') {
          numericPrice = parseFloat(item.price.replace(/[£$€,]/g, ''));
        }
        
        return {
          venue_id,
          name: item.name.trim(),
          description: item.description || null,
          price: Math.round(numericPrice * 100) / 100, // Round to 2 decimal places
          category: item.category || 'Uncategorized',
          available: true
        };
      });

    console.log('[AUTH DEBUG] Valid items after filtering:', validItems.length);

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
        const { data: insertedItem, error: insertErr } = await supa
          .from('menu_items')
          .insert(item)
          .select()
          .single();

        if (insertErr) {
          console.error('[AUTH DEBUG] Failed to insert item:', insertErr.message);
          skipped++;
        } else {
          inserted++;
        }
      }
    }

    console.log('[AUTH DEBUG] Final result - Inserted:', inserted, 'Skipped:', skipped, 'Total processed:', validItems.length);

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

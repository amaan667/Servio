import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { extractTextFromPdf } from '@/lib/googleVisionOCR';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supa = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const venueId = formData.get('venue_id') as string;

    if (!file || !venueId) {
      return NextResponse.json({ ok: false, error: 'Missing file or venue_id' }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Processing PDF for venue:', venueId);
    console.log('[AUTH DEBUG] File name:', file.name);
    console.log('[AUTH DEBUG] File size:', file.size);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text using Google Vision OCR
    let text;
    try {
      text = await extractTextFromPdf(buffer, file.name);
      console.log('[AUTH DEBUG] OCR completed successfully');
    } catch (ocrError) {
      console.error('[AUTH DEBUG] OCR failed:', ocrError);
      return NextResponse.json({ 
        ok: false, 
        error: `OCR failed: ${ocrError.message}` 
      }, { status: 500 });
    }

    if (!text || text.length < 100) {
      return NextResponse.json({ 
        ok: false, 
        error: 'OCR extracted insufficient text. Please ensure the PDF contains clear, readable menu text.' 
      }, { status: 400 });
    }

    // Extract menu items using OpenAI with comprehensive extraction
    const prompt = `You are a professional menu extraction expert. Extract ALL menu items from this restaurant menu text with 100% accuracy. Return ONLY a valid JSON object with this exact schema:

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

CRITICAL EXTRACTION RULES:
- Extract EVERY single menu item with a price - do not miss any
- Look for prices in all formats: £7.50, 7.50, £7, 7, etc.
- Normalize all prices to numbers (strip £, $, € symbols)
- Use exact category names from the menu: STARTERS, MAIN COURSES, DESSERTS, DRINKS, SALADS, etc.
- Include items even if description is missing
- Only filter out items with no price or price = 0
- Be extremely thorough - extract items from all sections
- Preserve the exact item names and descriptions
- Do not skip items that seem incomplete - extract what you can
- Ensure all JSON strings are properly escaped
- Return valid JSON only - no trailing commas, no unescaped quotes

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
        console.log('[AUTH DEBUG] Attempting to fix JSON issues...');
        
        // Remove trailing commas and fix common issues
        let fixedContent = content
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .replace(/([^"])\s*}\s*$/g, '$1}') // Fix missing closing braces
          .replace(/([^"])\s*]\s*$/g, '$1]') // Fix missing closing brackets
          .replace(/([^\\])"/g, '$1\\"') // Escape unescaped quotes
          .replace(/\\"/g, '"') // Fix double-escaped quotes
          .replace(/\n/g, '\\n') // Escape newlines
          .replace(/\r/g, '\\r') // Escape carriage returns
          .replace(/\t/g, '\\t'); // Escape tabs
        
        // Try to find the end of the JSON object
        const lastBrace = fixedContent.lastIndexOf('}');
        if (lastBrace > 0) {
          fixedContent = fixedContent.substring(0, lastBrace + 1);
        }
        
        console.log('[AUTH DEBUG] Fixed content preview:', fixedContent.substring(0, 500));
        
        parsed = JSON.parse(fixedContent);
        console.log('[AUTH DEBUG] Successfully parsed after fixing JSON issues');
      } catch (fixErr) {
        console.error('[AUTH DEBUG] Failed to fix JSON:', fixErr);
        console.error('[AUTH DEBUG] Attempted fix content:', fixedContent.substring(0, 1000));
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
          venue_id: venueId,
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
    console.error('[AUTH DEBUG] PDF processing error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `PDF processing failed: ${error.message}` 
    }, { status: 500 });
  }
}

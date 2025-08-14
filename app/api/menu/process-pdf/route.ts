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
    console.log('[AUTH DEBUG] Buffer first 100 bytes:', buffer.slice(0, 100));

    // Extract text using a simple approach - try to find text content in the PDF
    let text = '';
    try {
      console.log('[AUTH DEBUG] Attempting simple text extraction...');
      
      // Convert buffer to string and look for text patterns
      const bufferString = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
      
      // Look for common PDF text markers
      const textMatches = bufferString.match(/\/Text\s*\[(.*?)\]/g);
      const contentMatches = bufferString.match(/\/Contents\s*\[(.*?)\]/g);
      
      if (textMatches && textMatches.length > 0) {
        text = textMatches.join(' ');
        console.log('[AUTH DEBUG] Found text markers:', textMatches.length);
      } else if (contentMatches && contentMatches.length > 0) {
        text = contentMatches.join(' ');
        console.log('[AUTH DEBUG] Found content markers:', contentMatches.length);
      } else {
        // Try to extract any readable text from the buffer
        const readableText = bufferString.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
        if (readableText.length > 100) {
          text = readableText;
          console.log('[AUTH DEBUG] Extracted readable text from buffer');
        }
      }
      
      console.log('[AUTH DEBUG] Extracted text length:', text.length);
      console.log('[AUTH DEBUG] FULL EXTRACTED TEXT:', text);
      console.log('[AUTH DEBUG] Text preview:', text.substring(0, 500));
      
      if (!text || text.trim().length === 0) {
        console.log('[AUTH DEBUG] No text extracted from PDF');
        return NextResponse.json({ 
          ok: false, 
          error: 'No text could be extracted from PDF. This appears to be an image-based PDF. Please use OCR tools to convert it to text first, then upload the text file.' 
        }, { status: 400 });
      }
    } catch (parseError) {
      console.error('[AUTH DEBUG] Text extraction error details:', parseError);
      console.error('[AUTH DEBUG] Error name:', parseError.name);
      console.error('[AUTH DEBUG] Error message:', parseError.message);
      console.error('[AUTH DEBUG] Error stack:', parseError.stack);
      
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to extract text from PDF: ${parseError.message}. This might be an image-based PDF that needs OCR.` 
      }, { status: 500 });
    }

    if (text.length < 200) {
      console.log('[AUTH DEBUG] Text too short:', text.length);
      console.log('[AUTH DEBUG] Short text content:', text);
      return NextResponse.json({ 
        ok: false, 
        error: 'Extracted text is too short (less than 200 characters). This might be an image-based PDF. Please use OCR tools to convert it to text first.' 
      }, { status: 400 });
    }

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
    console.log('[AUTH DEBUG] Text preview (first 1000 chars):', text.substring(0, 1000));

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
    console.log('[AUTH DEBUG] Extracted', items.length, 'menu items from OpenAI');
    console.log('[AUTH DEBUG] Raw items from OpenAI:', JSON.stringify(items, null, 2));

    // More lenient validation - only filter out completely invalid items
    const validItems = items
      .filter((item: any) => {
        // Check if item has basic required fields
        const hasName = item.name && typeof item.name === 'string' && item.name.trim().length > 0;
        const hasPrice = item.price !== undefined && item.price !== null;
        
        if (!hasName) {
          console.log('[AUTH DEBUG] Filtered out item with no name:', item);
          return false;
        }
        
        if (!hasPrice) {
          console.log('[AUTH DEBUG] Filtered out item with no price:', item);
          return false;
        }
        
        // Convert price to number if it's a string
        let numericPrice = item.price;
        if (typeof item.price === 'string') {
          numericPrice = parseFloat(item.price.replace(/[£$€,]/g, ''));
        }
        
        if (isNaN(numericPrice) || numericPrice <= 0) {
          console.log('[AUTH DEBUG] Filtered out item with invalid price:', item, 'numericPrice:', numericPrice);
          return false;
        }
        
        // Check name length
        if (item.name.length > 80) {
          console.log('[AUTH DEBUG] Filtered out item with name too long:', item.name, 'length:', item.name.length);
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
    console.log('[AUTH DEBUG] Items to insert:', validItems.map((item: any) => ({ 
      name: item.name, 
      category: item.category, 
      price: item.price,
      description: item.description 
    })));

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

    console.log('[AUTH DEBUG] Final result - Inserted:', inserted, 'Skipped:', skipped, 'Total processed:', validItems.length);

    return NextResponse.json({
      ok: true,
      counts: { inserted, skipped },
      total: validItems.length
    });

  } catch (error) {
    console.error('[AUTH DEBUG] Process PDF error:', error);
    console.error('[AUTH DEBUG] Error name:', error.name);
    console.error('[AUTH DEBUG] Error message:', error.message);
    console.error('[AUTH DEBUG] Error stack:', error.stack);
    return NextResponse.json({ ok: false, error: 'Processing failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getOpenAI } from '@/lib/openai';
import { isMenuLike } from '@/lib/menuLike';
import { tryParseMenuWithGPT } from '@/lib/safeParse';
import { PDFDocument } from 'pdf-lib';
import { apiLogger, logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const openai = getOpenAI();
      const supa = await createClient();
    const { uploadId } = await req.json();
    

    // Get upload record
    const { data: row, error: fetchErr } = await supa
      .from('menu_uploads')
      .select('*')
      .eq('id', uploadId)
      .maybeSingle();

    if (fetchErr || !row) {
      logger.error('[AUTH DEBUG] Failed to fetch upload:', fetchErr);
      return NextResponse.json({ ok: false, error: 'Upload not found' }, { status: 404 });
    }


    // Download original file from Supabase Storage (pdf or image)
    const storagePath = row.filename || `${row.venue_id}/${row.sha256}.pdf`;
    
    const { data: file, error: dlErr } = await supa.storage.from('menus').download(storagePath);
    if (dlErr) {
      logger.error('[AUTH DEBUG] Failed to download file:', dlErr);
      return NextResponse.json({ ok: false, error: 'Failed to download file' }, { status: 500 });
    }


    const fileBytes = await file.arrayBuffer();

    const isPdf = storagePath.toLowerCase().endsWith('.pdf');
    let pdfPages: string[] = [];
    let maxPages = 1;

    if (isPdf) {
      const pdfDoc = await PDFDocument.load(fileBytes);
      const pageCount = pdfDoc.getPageCount();
      maxPages = Math.min(pageCount, 6);
      for (let i = 0; i < maxPages; i++) {
        const singlePagePdf = await PDFDocument.create();
        const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
        singlePagePdf.addPage(copiedPage);
        const singlePageBytes = await singlePagePdf.save();
        const base64 = Buffer.from(singlePageBytes).toString('base64');
        pdfPages.push(`data:application/pdf;base64,${base64}`);
      }
    } else {
      const lower = storagePath.toLowerCase();
      const mime = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
        ? 'image/webp'
        : lower.endsWith('.heic')
        ? 'image/heic'
        : 'image/jpeg';
      const base64 = Buffer.from(fileBytes).toString('base64');
      pdfPages = [`data:${mime};base64,${base64}`];
      maxPages = 1;
    }

    // Try to extract text from first page for menu-likeness check
    let rawText = '';
    try {
      const firstPage = pdfPages[0];
      const visionResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all text from this page/image. Return only the raw text, no formatting or structure.' },
              { type: 'image_url', image_url: { url: firstPage } }
            ]
          }
        ],
        max_tokens: 2000
      });
      
      rawText = visionResponse.choices[0]?.message?.content || '';
    } catch (textErr) {
      logger.error('[AUTH DEBUG] Failed to extract text:', textErr);
      rawText = 'Failed to extract text';
    }

    // Check if text is menu-like
    const isMenuLikeResult = isMenuLike(rawText);

    if (!isMenuLikeResult) {
      
      // Update status to needs_review
      await supa
        .from('menu_uploads')
        .update({ 
          status: 'needs_review', 
          raw_text: rawText,
          error: 'Text not menu-like'
        })
        .eq('id', uploadId);

      return NextResponse.json({ 
        ok: false, 
        error: 'Text not menu-like',
        isMenuLike: isMenuLikeResult,
        preview: rawText.substring(0, 200) + '...'
      });
    }

    // Process pages/images with OpenAI Vision
    
    const allMenuItems: any[] = [];
    let totalTokens = 0;

    // Process all pages in parallel for faster processing
    const pagePromises = pdfPages.map(async (page, i) => {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a menu parsing expert. Extract menu items from this PDF page and return ONLY a valid JSON array. Each item should have: category (string), name (string), price (number), description (string, optional), x_percent (number 0-100), y_percent (number 0-100). 

IMPORTANT: For x_percent and y_percent, provide the approximate center position of the menu item on the page as a percentage (0-100). This is used to place interactive buttons on the menu. Ignore headers, footers, "about us", allergy info, or promotional text. Focus only on food/drink items with prices.`
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract menu items from this page/image with their positions. Return valid JSON array only. Include x_percent and y_percent for each item based on where it appears on the page.' },
                { type: 'image_url', image_url: { url: page } }
              ]
            }
          ],
          max_tokens: 2000,
          temperature: 0.1
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          try {
            const items = JSON.parse(content);
            if (Array.isArray(items)) {
              // Add page_index to each item for hotspot creation
              const itemsWithPage = items.map((item: any) => ({
                ...item,
                page_index: i
              }));
              return { items: itemsWithPage, tokens: response.usage?.total_tokens || 0, page: i + 1 };
            }
          } catch (parseErr) {
            logger.error('[AUTH DEBUG] Failed to parse JSON from page', i + 1, ':', parseErr);
          }
        }

        return { items: [], tokens: response.usage?.total_tokens || 0, page: i + 1 };
        
      } catch (visionErr) {
        logger.error('[AUTH DEBUG] Vision API error on page', i + 1, ':', visionErr);
        return { items: [], tokens: 0, page: i + 1 };
      }
    });

    // Wait for all pages to complete
    const results = await Promise.all(pagePromises);
    
    // Combine results
    results.forEach(result => {
      allMenuItems.push(...result.items);
      totalTokens += result.tokens;
    });


    // Save results
    const { error: updateErr } = await supa
      .from('menu_uploads')
      .update({
        status: 'processed',
        raw_text: rawText,
        parsed_json: allMenuItems,
        pages: maxPages
      })
      .eq('id', uploadId);

    if (updateErr) {
      logger.error('[AUTH DEBUG] Failed to update upload:', updateErr);
      return NextResponse.json({ ok: false, error: 'Failed to save results' }, { status: 500 });
    }

    // Auto-create hotspots if coordinates are available
    let hotspotsCreated = 0;
    if (allMenuItems.length > 0 && allMenuItems[0].x_percent !== undefined) {
      try {
        logger.debug('[AUTH DEBUG] Auto-creating hotspots from extraction...');
        
        // Get venue_id from upload record
        const { data: uploadData } = await supa
          .from('menu_uploads')
          .select('venue_id')
          .eq('id', uploadId)
          .single();
        
        if (uploadData?.venue_id) {
          // Insert menu items first
          const itemsToInsert = allMenuItems.map((item: any) => ({
            venue_id: uploadData.venue_id,
            name: item.name,
            description: item.description || null,
            price: Math.round(item.price * 100), // Convert to cents
            category: item.category || 'UNCATEGORIZED',
            is_available: true
          }));
          
          const { data: insertedItems, error: itemsError } = await supa
            .from('menu_items')
            .insert(itemsToInsert)
            .select('id, name');
          
          if (!itemsError && insertedItems) {
            // Create hotspots by matching items
            const hotspots = allMenuItems
              .map((item: any, index: number) => {
                const menuItem = insertedItems.find((mi: any) => mi.name === item.name);
                if (menuItem && item.x_percent !== undefined && item.y_percent !== undefined) {
                  return {
                    venue_id: uploadData.venue_id,
                    menu_item_id: menuItem.id,
                    menu_upload_id: uploadId,
                    page_index: item.page_index || 0,
                    x_percent: item.x_percent,
                    y_percent: item.y_percent,
                    confidence: 0.95, // High confidence from GPT-4o
                    detection_method: 'auto_extraction',
                    is_active: true
                  };
                }
                return null;
              })
              .filter((h: any) => h !== null);
            
            if (hotspots.length > 0) {
              const { error: hotspotsError } = await supa
                .from('menu_hotspots')
                .insert(hotspots);
              
              if (!hotspotsError) {
                hotspotsCreated = hotspots.length;
                logger.debug('[AUTH DEBUG] Auto-created', hotspotsCreated, 'hotspots');
              } else {
                logger.error('[AUTH DEBUG] Failed to create hotspots:', hotspotsError);
              }
            }
          }
        }
      } catch (hotspotErr) {
        logger.error('[AUTH DEBUG] Hotspot creation error:', hotspotErr);
        // Don't fail the whole request if hotspot creation fails
      }
    }

    return NextResponse.json({
      ok: true,
      items: allMenuItems,
      pages: maxPages,
      tokens: totalTokens,
      hotspots_created: hotspotsCreated,
      preview: rawText.substring(0, 200) + '...'
    });

  } catch (error) {
    logger.error('[AUTH DEBUG] Process error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ ok: false, error: 'Processing failed' }, { status: 500 });
  }
}



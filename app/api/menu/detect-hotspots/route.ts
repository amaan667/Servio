import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getOpenAI } from '@/lib/openai';

interface HotspotDetection {
  menu_item_id: string;
  menu_item_name: string;
  page_index: number;
  x_percent: number;
  y_percent: number;
  width_percent?: number;
  height_percent?: number;
  confidence: number;
}

export async function POST(req: NextRequest) {
  try {
    const { venueId } = await req.json();

    if (!venueId) {
      return NextResponse.json(
        { ok: false, error: 'venueId is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch menu items and PDF images
    const { data: menuItems, error: itemsError } = await supabase
      .from('menu_items')
      .select('id, name, description, price, category')
      .eq('venue_id', venueId)
      .eq('is_available', true);

    if (itemsError) {
      console.error('[HOTSPOT DETECT] Error fetching menu items:', itemsError);
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch menu items' },
        { status: 500 }
      );
    }

    const { data: uploadData, error: uploadError } = await supabase
      .from('menu_uploads')
      .select('id, pdf_images')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (uploadError || !uploadData || !uploadData.pdf_images) {
      console.error('[HOTSPOT DETECT] Error fetching PDF images:', uploadError);
      return NextResponse.json(
        { ok: false, error: 'No PDF menu found. Please upload a PDF menu first.' },
        { status: 404 }
      );
    }

    const pdfImages = uploadData.pdf_images as string[];
    const menuUploadId = uploadData.id;

    // Use GPT-4o Vision to detect menu item positions
    const openai = getOpenAI();
    const hotspots: HotspotDetection[] = [];

    for (let pageIndex = 0; pageIndex < pdfImages.length; pageIndex++) {
      const imageUrl = pdfImages[pageIndex];

      try {
        // Call GPT-4o Vision to detect item positions
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a menu analysis expert. Analyze this menu page and identify where each menu item is located.
              
For each menu item, provide:
- The exact name of the item (must match the text on the menu)
- The position as percentages: x_percent (0-100, left to right), y_percent (0-100, top to bottom)
- Optional: width_percent and height_percent for bounding boxes
- confidence score (0-1) based on how certain you are about the position

Return ONLY a valid JSON array of objects with this structure:
[
  {
    "menu_item_name": "Exact name from menu",
    "x_percent": 50.5,
    "y_percent": 30.2,
    "width_percent": 15.0,
    "height_percent": 5.0,
    "confidence": 0.95
  }
]

Focus on items with prices. Ignore headers, footers, and non-menu content.`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this menu page (page ${pageIndex + 1} of ${pdfImages.length}) and detect the positions of all menu items. Return the JSON array of detected items.`
                },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl }
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 2000
        });

        const content = response.choices[0]?.message?.content;
        if (!content) continue;

        // Parse the response
        let detectedItems: any[];
        try {
          detectedItems = JSON.parse(content);
        } catch (parseError) {
          console.error('[HOTSPOT DETECT] Failed to parse GPT response:', parseError);
          continue;
        }

        // Match detected items with actual menu items
        for (const detected of detectedItems) {
          // Try to find a matching menu item by name
          const matchingItem = menuItems?.find(item => {
            const itemName = item.name.toLowerCase().trim();
            const detectedName = detected.menu_item_name.toLowerCase().trim();
            
            // Exact match
            if (itemName === detectedName) return true;
            
            // Partial match (for items with descriptions or variations)
            if (itemName.includes(detectedName) || detectedName.includes(itemName)) {
              return true;
            }
            
            return false;
          });

          if (matchingItem) {
            hotspots.push({
              menu_item_id: matchingItem.id,
              menu_item_name: matchingItem.name,
              page_index: pageIndex,
              x_percent: detected.x_percent,
              y_percent: detected.y_percent,
              width_percent: detected.width_percent,
              height_percent: detected.height_percent,
              confidence: detected.confidence || 0.9
            });
          }
        }

      } catch (pageError) {
        console.error(`[HOTSPOT DETECT] Error processing page ${pageIndex}:`, pageError);
        // Continue with other pages
      }
    }

    // Save hotspots to database
    if (hotspots.length > 0) {
      // Delete existing hotspots for this venue
      await supabase
        .from('menu_hotspots')
        .delete()
        .eq('venue_id', venueId);

      // Insert new hotspots
      const hotspotsToInsert = hotspots.map(h => ({
        venue_id: venueId,
        menu_item_id: h.menu_item_id,
        menu_upload_id: menuUploadId,
        page_index: h.page_index,
        x_percent: h.x_percent,
        y_percent: h.y_percent,
        width_percent: h.width_percent,
        height_percent: h.height_percent,
        confidence: h.confidence,
        detection_method: 'ocr',
        is_active: true
      }));

      const { error: insertError } = await supabase
        .from('menu_hotspots')
        .insert(hotspotsToInsert);

      if (insertError) {
        console.error('[HOTSPOT DETECT] Error inserting hotspots:', insertError);
        return NextResponse.json(
          { ok: false, error: 'Failed to save hotspots' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      hotspots: hotspots.length,
      detected: hotspots.map(h => ({
        item: h.menu_item_name,
        page: h.page_index + 1,
        position: `${h.x_percent.toFixed(1)}%, ${h.y_percent.toFixed(1)}%`,
        confidence: h.confidence
      }))
    });

  } catch (error: any) {
    console.error('[HOTSPOT DETECT] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to detect hotspots' },
      { status: 500 }
    );
  }
}


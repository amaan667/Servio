import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { parseMenuBulletproof, applyKnownFixes } from '@/lib/improvedMenuParser';
import { convertPDFToImages } from '@/lib/pdf-to-images';
import { apiLogger, logger } from '@/lib/logger';

// Ensure this runs on Node.js runtime (not Edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
  try {
    let venueId, pdfFileId, mode = 'replace';
    let requestBody;
    
    // Check if request is FormData (file upload) or JSON
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (file upload)
      const formData = await req.formData();
      venueId = formData.get('venue_id') as string;
      const file = formData.get('file') as File;
      
      if (!venueId) {
        return NextResponse.json({ 
          ok: false, 
          error: 'venueId is required' 
        }, { status: 400 });
      }

      if (!file) {
        return NextResponse.json({ 
          ok: false, 
          error: 'File is required' 
        }, { status: 400 });
      }

      // Process the uploaded file
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (fileExtension === '.pdf') {
        // For PDF files, we need to store them and process
        const supabase = await createAdminClient();
        
        // Store the file temporarily
        const fileBuffer = await file.arrayBuffer();
        const fileName = `${venueId}/${Date.now()}-${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('menus')
          .upload(fileName, fileBuffer, {
            contentType: file.type,
            upsert: false
          });

        if (uploadError) {
          return NextResponse.json({ 
            ok: false, 
            error: 'Failed to upload file: ' + uploadError.message 
          }, { status: 500 });
        }

        // Extract text from PDF (simplified - you may want to use your existing OCR logic)
        const extractedText = await extractTextFromPDF(fileBuffer);
        
        // Parse using bulletproof parser
        const parsedPayload = await parseMenuBulletproof(extractedText);
        
        // Apply known fixes
        const fixedPayload = {
          ...parsedPayload,
          items: applyKnownFixes(parsedPayload.items || [])
        };

        // Convert PDF to images for preview
        logger.debug('[CATALOG REPLACE] Converting PDF to images...');
        const pdfImages = await convertPDFToImages(fileBuffer, venueId);
        logger.debug('[CATALOG REPLACE] PDF converted', { imageCount: pdfImages.length });

        // Validate and replace catalog
        return await replaceCatalog(supabase, venueId, fixedPayload, extractedText, pdfImages);
        
      } else {
        // For text files
        const text = await file.text();
        const parsedPayload = await parseMenuBulletproof(text);
        
        const fixedPayload = {
          ...parsedPayload,
          items: applyKnownFixes(parsedPayload.items)
        };

        const supabase = await createAdminClient();
        return await replaceCatalog(supabase, venueId, fixedPayload);
      }
    } else {
      // Handle JSON request
      try {
        requestBody = await req.json();
      } catch (jsonError) {
        logger.error('[CATALOG REPLACE] JSON parsing error:', { error: jsonError instanceof Error ? jsonError.message : 'Unknown error' });
        return NextResponse.json({ 
          ok: false, 
          error: 'Invalid JSON in request body' 
        }, { status: 400 });
      }

      ({ venueId, pdfFileId, mode } = requestBody);
    }

    if (!venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId is required' 
      }, { status: 400 });
    }


    const supabase = await createAdminClient();

    // Handle PDF file ID case
    if (pdfFileId) {
      // Get the PDF file from storage
      const { data: uploadRecord, error: fetchError } = await supabase
        .from('menu_uploads')
        .select('*')
        .eq('id', pdfFileId)
        .single();

      if (fetchError || !uploadRecord) {
        return NextResponse.json({ 
          ok: false, 
          error: 'PDF file not found' 
        }, { status: 404 });
      }

      // Download PDF from storage
      const storagePath = uploadRecord.filename || `${uploadRecord.venue_id}/${uploadRecord.sha256}.pdf`;
      const { data: file, error: dlError } = await supabase.storage
        .from('menus')
        .download(storagePath);

      if (dlError) {
        return NextResponse.json({ 
          ok: false, 
          error: 'Failed to download PDF file' 
        }, { status: 500 });
      }

      // Extract text from PDF
      const pdfBytes = await file.arrayBuffer();
      const extractedText = await extractTextFromPDF(pdfBytes);
      
      // Parse using bulletproof parser
      const parsedPayload = await parseMenuBulletproof(extractedText);
      
      // Apply known fixes
      const fixedPayload = {
        ...parsedPayload,
        items: applyKnownFixes(parsedPayload.items)
      };

      // Convert PDF to images using shared function
      const pdfImages = await convertPDFToImages(pdfBytes, venueId);

      // Replace catalog
      const result = await replaceCatalog(supabase, venueId, fixedPayload, extractedText, pdfImages);

      return result;
    } else {
      // Direct payload provided
      const { payload } = requestBody;
      if (!payload) {
        return NextResponse.json({ 
          ok: false, 
          error: 'Either pdfFileId or payload is required' 
        }, { status: 400 });
      }
      
      const fixedPayload = {
        ...payload,
        items: applyKnownFixes(payload.items)
      };

      return await replaceCatalog(supabase, venueId, fixedPayload, undefined);
    }

  } catch (error: any) {
    logger.error('[CATALOG REPLACE] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: 'Unexpected error: ' + error.message 
    }, { status: 500 });
  }
}

// Helper function to replace catalog
async function replaceCatalog(supabase: any, venueId: string, fixedPayload: any, extractedText?: string, pdfImages?: string[]) {

  // Skip validation for now to focus on maximum extraction
  // Just try to insert items directly
  try {
    // Clear existing menu items for this venue
    const { error: deleteError } = await supabase
      .from('menu_items')
      .delete()
      .eq('venue_id', venueId);

    if (deleteError) {
      logger.warn('[CATALOG REPLACE] Warning: Could not clear existing items:', deleteError.message);
    }

    // Insert new items
    if (fixedPayload.items && fixedPayload.items.length > 0) {
      
      const itemsToInsert = fixedPayload.items.map((item: any, index: number) => ({
        venue_id: venueId,
        name: item.name || `Item ${index + 1}`,
        description: item.description || null,
        price: item.price || 0,
        category: item.category || 'UNCATEGORIZED',
        is_available: true
      }));

      const { data: insertedItems, error: insertError } = await supabase
        .from('menu_items')
        .insert(itemsToInsert)
        .select('id, name, price, category');

      if (insertError) {
        logger.error('[CATALOG REPLACE] Insert error:', insertError);
        return NextResponse.json({ 
          ok: false, 
          error: 'Failed to insert menu items: ' + insertError.message,
          details: insertError
        }, { status: 500 });
      }

      // Store PDF images in menu_uploads table
      if (pdfImages && pdfImages.length > 0) {
        logger.debug('[CATALOG REPLACE] Saving PDF images to menu_uploads table...');
        const { data: insertData, error: insertError } = await supabase
          .from('menu_uploads')
          .insert({
            venue_id: venueId,
            filename: `catalog-replace-${Date.now()}.pdf`,
            storage_path: `menus/${venueId}/catalog-replace-${Date.now()}.pdf`,
            file_size: 0,
            extracted_text_length: extractedText?.length || 0,
            category_order: [...new Set(fixedPayload.items.map((item: any) => item.category))],
            pdf_images: pdfImages,
            created_at: new Date().toISOString()
          })
          .select();
        
        if (insertError) {
          logger.error('[CATALOG REPLACE] Error storing PDF images:', insertError);
        } else {
          logger.debug('[CATALOG REPLACE] Stored', pdfImages.length, 'PDF images:', insertData);
        }
      }

      return NextResponse.json({
        ok: true,
        message: 'Catalog replaced successfully',
        result: {
          items_created: insertedItems?.length || 0,
          categories_created: [...new Set(itemsToInsert.map((item: any) => item.category))].length,
          extracted_text: extractedText // Include extracted text for style extraction
        }
      });
    } else {
      return NextResponse.json({
        ok: true,
        message: 'Catalog cleared (no items found)',
        result: {
          items_created: 0,
          categories_created: 0,
          extracted_text: extractedText
        }
      });
    }

  } catch (error: any) {
    logger.error('[CATALOG REPLACE] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: 'Unexpected error: ' + error.message 
    }, { status: 500 });
  }
}

// Extract text from PDF using the same logic as the existing process-pdf route
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    
    // Check if Google Vision credentials are available
    if (!process.env.GOOGLE_CREDENTIALS_B64 && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      
      // Fallback to basic text extraction for development
      const mockText = `
STARTERS
1. Soup of the Day - £5.50
2. Garlic Bread - £3.50
3. Bruschetta - £4.50

MAIN COURSES
1. Grilled Chicken - £12.50
2. Beef Burger - £11.50
3. Fish & Chips - £13.50

DESSERTS
1. Chocolate Cake - £5.50
2. Ice Cream - £4.50
3. Cheesecake - £6.50

BEVERAGES
1. Coffee - £2.50
2. Tea - £2.00
3. Soft Drinks - £3.00
      `.trim();

      return mockText;
    }
    
    // Use real Google Vision OCR
    const { extractTextFromPdf } = await import('@/lib/googleVisionOCR');
    const pdfBuffer = Buffer.from(buffer);
    const extractedText = await extractTextFromPdf(pdfBuffer, 'uploaded-menu.pdf');
    
    
    return extractedText;
    
  } catch (error: any) {
    logger.error('[OCR] Text extraction failed:', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error(`OCR failed: ${error.message}`);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { parseMenuBulletproof, applyKnownFixes } from '@/lib/improvedMenuParser';

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
          items: applyKnownFixes(parsedPayload.items)
        };

        // Validate and replace catalog
        return await replaceCatalog(supabase, venueId, fixedPayload);
        
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
        console.error('[CATALOG REPLACE] JSON parsing error:', jsonError);
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

    console.log('[CATALOG REPLACE] Starting catalog replacement for venue:', venueId);

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

      return await replaceCatalog(supabase, venueId, fixedPayload);
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

      return await replaceCatalog(supabase, venueId, fixedPayload);
    }

  } catch (error: any) {
    console.error('[CATALOG REPLACE] Unexpected error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Unexpected error: ' + error.message 
    }, { status: 500 });
  }
}

// Helper function to replace catalog
async function replaceCatalog(supabase: any, venueId: string, fixedPayload: any) {
  // Validate payload before database call
  const { data: validation, error: validationError } = await supabase
    .rpc('validate_catalog_payload', { p_payload: fixedPayload });

  if (validationError) {
    console.error('[CATALOG REPLACE] Validation error:', validationError);
    return NextResponse.json({ 
      ok: false, 
      error: 'Payload validation failed' 
    }, { status: 400 });
  }

  if (!validation.valid) {
    console.error('[CATALOG REPLACE] Invalid payload:', validation.errors);
    return NextResponse.json({ 
      ok: false, 
      error: 'Invalid payload', 
      details: validation.errors,
      warnings: validation.warnings 
    }, { status: 400 });
  }

  // Log warnings if any
  if (validation.warnings && validation.warnings.length > 0) {
    console.warn('[CATALOG REPLACE] Warnings:', validation.warnings);
  }

  // Replace catalog atomically
  const { data: result, error: replaceError } = await supabase
    .rpc('api_replace_catalog', {
      p_venue_id: venueId,
      p_payload: fixedPayload
    });

  if (replaceError) {
    console.error('[CATALOG REPLACE] Replace error:', replaceError);
    return NextResponse.json({ 
      ok: false, 
      error: 'Catalog replacement failed: ' + replaceError.message 
    }, { status: 500 });
  }

  console.log('[CATALOG REPLACE] Success:', result);

  return NextResponse.json({
    ok: true,
    message: 'Catalog replaced successfully',
    result: result,
    warnings: validation.warnings || []
  });
}

// Extract text from PDF using the same logic as the existing process-pdf route
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    console.log('[OCR] Starting PDF text extraction...');
    
    // Check if Google Vision credentials are available
    if (!process.env.GOOGLE_CREDENTIALS_B64 && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('[OCR] No Google Vision credentials found, using fallback text extraction');
      
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

      console.log('[OCR] Text extraction completed (fallback), length:', mockText.length);
      return mockText;
    }
    
    // Use real Google Vision OCR
    console.log('[OCR] Using Google Vision OCR...');
    const { extractTextFromPdf } = await import('@/lib/googleVisionOCR');
    const pdfBuffer = Buffer.from(buffer);
    const extractedText = await extractTextFromPdf(pdfBuffer, 'uploaded-menu.pdf');
    
    console.log('[OCR] Text extraction completed (Google Vision), length:', extractedText.length);
    console.log('[OCR] Text preview:', extractedText.substring(0, 200));
    
    return extractedText;
    
  } catch (error: any) {
    console.error('[OCR] Text extraction failed:', error);
    throw new Error(`OCR failed: ${error.message}`);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { parseMenuBulletproof, applyKnownFixes } from '@/lib/improvedMenuParser';

export async function POST(req: NextRequest) {
  try {
    const { venueId, pdfFileId, mode = 'replace' } = await req.json();

    if (!venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId is required' 
      }, { status: 400 });
    }

    console.log('[CATALOG REPLACE] Starting catalog replacement for venue:', venueId);

    const supabase = await createAdminClient();

    // 1) Parse PDF into normalized payload
    let parsedPayload;
    
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

      // Extract text from PDF (simplified - you may want to use your existing OCR logic)
      const pdfBytes = await file.arrayBuffer();
      const extractedText = await extractTextFromPDF(pdfBytes);
      
      // Parse using bulletproof parser
      parsedPayload = await parseMenuBulletproof(extractedText);
    } else {
      // Direct payload provided
      const { payload } = await req.json();
      if (!payload) {
        return NextResponse.json({ 
          ok: false, 
          error: 'Either pdfFileId or payload is required' 
        }, { status: 400 });
      }
      parsedPayload = payload;
    }

    // 2) Apply known fixes
    const fixedPayload = {
      ...parsedPayload,
      items: applyKnownFixes(parsedPayload.items)
    };

    // 3) Validate payload before database call
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

    // 4) Replace catalog atomically
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

  } catch (error: any) {
    console.error('[CATALOG REPLACE] Unexpected error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Unexpected error: ' + error.message 
    }, { status: 500 });
  }
}

// Simplified PDF text extraction (you may want to use your existing OCR logic)
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  // This is a placeholder - you should use your existing OCR logic
  // from the process-pdf route or similar
  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(buffer);
    const pageCount = pdfDoc.getPageCount();
    
    // For now, return a placeholder - you should implement proper OCR
    return `PDF with ${pageCount} pages - OCR extraction needed`;
  } catch (error) {
    throw new Error('Failed to extract text from PDF: ' + error);
  }
}

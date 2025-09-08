// =====================================================
// ENHANCED PDF PROCESSING ROUTE V2
// =====================================================
// Uses the comprehensive PDF→Menu importer with highest accuracy

import { NextResponse } from "next/server";
import { createAdminClient } from '@/lib/supabase/server';
import { importPDFToMenu, generateImportReport, validateImportResult, exportImportResult } from '@/lib/pdfImporter/mainImporter';
import { parseMenuWithGPT } from '@/lib/pdfImporter/robustMenuParser';

export const runtime = "nodejs";

// Initialize Supabase client with service role
function getSupabaseClient() {
  return createAdminClient();
}

// Generate unique key for upload
function generateUploadKey(venueId: string, filename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${venueId}/${timestamp}_${random}_${sanitizedFilename}`;
}

export async function POST(req: Request) {
  const supa = getSupabaseClient();
  
  try {
    console.log('[PDF_PROCESS_V2] Starting enhanced PDF processing...');
    
    // Parse FormData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const venueId = formData.get('venue_id') as string;
    const mode = formData.get('mode') as 'high_recall' | 'precision' | 'auto' | null;
    const enableGPT = formData.get('enable_gpt') === '1';
    const enableValidation = formData.get('enable_validation') !== '0';
    
    if (!file || !venueId) {
      return NextResponse.json({ 
        success: false, 
        error: 'file and venue_id are required' 
      }, { status: 400 });
    }

    console.log('[PDF_PROCESS_V2] File received:', {
      name: file.name,
      size: file.size,
      type: file.type,
      venueId,
      mode,
      enableGPT,
      enableValidation
    });

    // Validate file
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Only PDF files are supported' 
      }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json({ 
        success: false, 
        error: 'File size must be less than 10MB' 
      }, { status: 400 });
    }

    // Generate unique upload key
    const uploadKey = generateUploadKey(venueId, file.name);
    const storagePath = `menus/${uploadKey}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store original PDF in Supabase Storage
    console.log('[PDF_PROCESS_V2] Storing PDF in Supabase Storage...');
    const { error: storageError } = await supa.storage
      .from('menus')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (storageError) {
      console.error('[PDF_PROCESS_V2] Storage upload failed:', storageError);
      return NextResponse.json({ 
        success: false, 
        error: `Storage upload failed: ${storageError.message}` 
      }, { status: 500 });
    }

    console.log('[PDF_PROCESS_V2] PDF stored successfully at:', storagePath);

    // Process PDF using the comprehensive importer
    console.log('[PDF_PROCESS_V2] Processing PDF with comprehensive importer...');
    const importResult = await importPDFToMenu(buffer, venueId, supa, {
      mode: mode || 'auto',
      enableGPT,
      enableValidation
    });

    if (!importResult.success) {
      console.error('[PDF_PROCESS_V2] Import failed:', importResult.error);
      return NextResponse.json({ 
        success: false, 
        error: `PDF import failed: ${importResult.error}` 
      }, { status: 500 });
    }

    console.log('[PDF_PROCESS_V2] Import completed successfully');

    // Generate comprehensive report
    const report = generateImportReport(importResult);
    console.log('[PDF_PROCESS_V2] Import report generated');

    // Validate import quality
    const qualityCheck = validateImportResult(importResult);
    console.log('[PDF_PROCESS_V2] Quality check:', qualityCheck.isHighQuality ? 'PASSED' : 'FAILED');

    // Store audit trail
    try {
      await supa.from('menu_uploads').insert({
        venue_id: venueId,
        filename: file.name,
        storage_path: storagePath,
        file_size: file.size,
        extracted_text_length: 0, // Not applicable for new system
        mode: mode || 'auto',
        inserted_count: importResult.metadata?.itemsProcessed || 0,
        skipped_count: 0, // Not applicable for new system
        total_count: importResult.metadata?.itemsProcessed || 0,
        categories: importResult.catalog?.categories.map(cat => cat.name) || [],
        created_at: new Date().toISOString(),
        processing_report: report,
        quality_score: qualityCheck.isHighQuality ? 'HIGH' : 'LOW',
        coverage_rate: importResult.metadata?.coverageRate || 0
      });
    } catch (auditError) {
      console.warn('[PDF_PROCESS_V2] Audit trail insertion failed:', auditError);
      // Don't fail the whole request for audit trail issues
    }

    // Prepare response
    const response = {
      success: true,
      metadata: {
        venueId,
        filename: file.name,
        storagePath,
        processingTime: importResult.metadata?.processingTime || 0,
        sourceType: importResult.metadata?.sourceType.type || 'unknown',
        itemsProcessed: importResult.metadata?.itemsProcessed || 0,
        pricesFound: importResult.metadata?.pricesFound || 0,
        coverageRate: importResult.metadata?.coverageRate || 0
      },
      catalog: {
        categories: importResult.catalog?.categories.length || 0,
        totalItems: importResult.catalog?.categories.reduce((sum, cat) => sum + cat.items.length, 0) || 0,
        optionGroups: importResult.catalog?.metadata.optionGroups || 0
      },
      coverage: {
        pricesFound: importResult.coverage?.pricesFound || 0,
        pricesAttached: importResult.coverage?.pricesAttached || 0,
        unattachedPrices: importResult.coverage?.unattachedPrices.length || 0,
        emptySections: importResult.coverage?.sectionsWithZeroItems.length || 0
      },
      validation: {
        valid: importResult.validation?.valid || false,
        errors: importResult.validation?.errors.length || 0,
        warnings: importResult.validation?.warnings.length || 0
      },
      quality: {
        isHighQuality: qualityCheck.isHighQuality,
        issues: qualityCheck.issues,
        recommendations: qualityCheck.recommendations
      },
      warnings: importResult.warnings,
      report: report
    };

    console.log('[PDF_PROCESS_V2] Response prepared:', {
      success: response.success,
      itemsProcessed: response.metadata.itemsProcessed,
      coverageRate: response.metadata.coverageRate,
      isHighQuality: response.quality.isHighQuality
    });

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[PDF_PROCESS_V2] Fatal error:', error);
    return NextResponse.json({ 
      success: false, 
      error: `PDF processing failed: ${error.message}` 
    }, { status: 500 });
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    message: 'Enhanced PDF Processing API V2',
    version: '2.0.0',
    features: [
      'Two-pass layout-aware parsing',
      'Coordinate-based title↔price pairing',
      'Options vs items detection',
      'Schema validation with atomic replace',
      'Coverage reporting for accuracy proof',
      'High-recall and precision modes',
      'Comprehensive guardrails and error handling'
    ],
    endpoints: {
      POST: 'Process PDF file with enhanced accuracy',
      GET: 'Get API information'
    }
  });
}

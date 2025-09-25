// =====================================================
// JSON REPAIR API ENDPOINT
// =====================================================
// Repairs broken JSON from GPT menu extraction

import { NextResponse } from "next/server";
import { repairAndValidateMenuJSON, validateMenuJSON } from '@/lib/pdfImporter/jsonRepair';
import { logInfo, logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    logInfo('[JSON_REPAIR_API] Starting JSON repair...');
    
    const { json } = await req.json();
    
    if (!json || typeof json !== 'string') {
      return NextResponse.json({ 
        success: false, 
        error: 'JSON string is required' 
      }, { status: 400 });
    }

    logInfo('[JSON_REPAIR_API] Input JSON length:', json.length);

    // First, validate the original JSON
    const originalValidation = validateMenuJSON(json);
    logInfo('[JSON_REPAIR_API] Original validation:', {
      valid: originalValidation.valid,
      errors: originalValidation.errors.length,
      items: originalValidation.items.length
    });

    // If already valid, return as-is
    if (originalValidation.valid) {
      return NextResponse.json({
        success: true,
        valid: true,
        items: originalValidation.items,
        json: json,
        message: 'JSON was already valid'
      });
    }

    // Attempt to repair the JSON
    const repairResult = repairAndValidateMenuJSON(json);
    
    if (repairResult.success) {
      logInfo('[JSON_REPAIR_API] Repair successful:', {
        items: repairResult.items?.length || 0
      });
      
      return NextResponse.json({
        success: true,
        valid: true,
        items: repairResult.items,
        json: repairResult.json,
        message: 'JSON was successfully repaired',
        originalErrors: originalValidation.errors,
        itemsExtracted: repairResult.items?.length || 0
      });
    } else {
      logError('[JSON_REPAIR_API] Repair failed:', repairResult.errors);
      
      return NextResponse.json({
        success: false,
        valid: false,
        errors: repairResult.errors,
        originalErrors: originalValidation.errors,
        message: 'JSON repair failed'
      }, { status: 400 });
    }

  } catch (error: any) {
    logError('[JSON_REPAIR_API] Fatal error:', error);
    return NextResponse.json({ 
      success: false, 
      error: `JSON repair failed: ${error.message}` 
    }, { status: 500 });
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    message: 'JSON Repair API',
    version: '1.0.0',
    description: 'Repairs broken JSON from GPT menu extraction',
    usage: {
      method: 'POST',
      body: {
        json: 'string - The broken JSON to repair'
      },
      response: {
        success: 'boolean',
        valid: 'boolean',
        items: 'array - Extracted menu items',
        json: 'string - Repaired JSON',
        message: 'string - Status message'
      }
    },
    examples: {
      broken: {
        json: '{"items": [{"title": "Item", "price": 10.50, "price": 12.00}]}'
      },
      fixed: {
        json: '{"items": [{"title": "Item", "category": "MAINS", "price": 12.00, "currency": "GBP", "description": ""}]}'
      }
    }
  });
}

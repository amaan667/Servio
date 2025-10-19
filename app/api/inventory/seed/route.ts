export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { seedInventoryData } from '@/lib/inventory-seed';
import { logger } from '@/lib/logger';
import { getErrorMessage, getErrorDetails } from '@/lib/utils/errors';

// POST /api/inventory/seed
// Seeds inventory data for a venue (for testing/demo purposes)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { venue_id } = body;

    if (!venue_id) {
      return NextResponse.json(
        { error: 'venue_id is required' },
        { status: 400 }
      );
    }

    const result = await seedInventoryData(venue_id);

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('[INVENTORY SEED API] Error:', { error: error instanceof Error ? getErrorMessage(error) : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to seed inventory data' },
      { status: 500 }
    );
  }
}


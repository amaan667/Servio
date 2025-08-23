import { NextResponse } from 'next/server';
import { errorLogger } from '@/lib/error-logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '10');
    const clear = searchParams.get('clear') === 'true';
    
    console.log('[ERROR-LOGS] Requesting error logs, count:', count, 'clear:', clear);
    
    if (clear) {
      errorLogger.clearLogs();
      console.log('[ERROR-LOGS] Logs cleared');
      return NextResponse.json({ 
        message: 'Logs cleared',
        timestamp: new Date().toISOString()
      });
    }
    
    const logs = errorLogger.getRecentErrors(count);
    console.log('[ERROR-LOGS] Returning', logs.length, 'error logs');
    
    return NextResponse.json({
      logs,
      total: logs.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[ERROR-LOGS] Error fetching logs:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch error logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { error, context } = body;
    
    console.log('[ERROR-LOGS] Manually logging error:', error);
    
    errorLogger.logError(error, context, request);
    
    return NextResponse.json({ 
      message: 'Error logged successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[ERROR-LOGS] Error logging manual error:', error);
    return NextResponse.json({ 
      error: 'Failed to log error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
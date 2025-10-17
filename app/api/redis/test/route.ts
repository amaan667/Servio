import { NextResponse } from 'next/server';
import { cache } from '@/lib/cache';

export async function GET() {
  try {
    const testKey = 'redis-test';
    const testValue = { message: 'Hello Redis!', timestamp: Date.now() };
    
    // Set value in cache
    await cache.set(testKey, testValue, 60);
    
    // Get value from cache
    const retrieved = await cache.get(testKey);
    
    // Check if it matches
    if (JSON.stringify(retrieved) === JSON.stringify(testValue)) {
      return NextResponse.json({
        success: true,
        message: 'Redis is working!',
        data: retrieved,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Redis test failed - data mismatch',
        expected: testValue,
        got: retrieved
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Redis connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


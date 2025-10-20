import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Track server start time for uptime calculation
const startTime = Date.now();

export async function GET() {
  const uptime = Math.floor((Date.now() - startTime) / 1000); // uptime in seconds
  
  return NextResponse.json({
    status: 'ok',
    version: process.env.npm_package_version || '0.1.1',
    uptime,
    timestamp: new Date().toISOString(),
  }, { 
    status: 200,
  });
}

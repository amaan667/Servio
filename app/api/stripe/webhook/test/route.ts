import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Stripe webhook endpoint is accessible',
    timestamp: new Date().toISOString(),
    endpoint: '/api/stripe/webhook'
  });
}

export async function POST() {
  return NextResponse.json({ 
    message: 'Stripe webhook POST endpoint is accessible',
    timestamp: new Date().toISOString(),
    endpoint: '/api/stripe/webhook'
  });
}

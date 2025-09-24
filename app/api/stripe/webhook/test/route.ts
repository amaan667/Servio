import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Stripe webhook endpoint is accessible',
    timestamp: new Date().toISOString(),
    url: process.env.NEXT_PUBLIC_APP_URL + '/api/stripe/webhook'
  });
}

export async function POST() {
  return NextResponse.json({ 
    message: 'Stripe webhook endpoint is accessible via POST',
    timestamp: new Date().toISOString()
  });
}
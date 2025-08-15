import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { amount, currency = 'gbp', metadata } = await req.json();
    if (!ENV.STRIPE_SECRET_KEY) {
      return NextResponse.json({ ok:false, error:'Missing STRIPE_SECRET_KEY' }, { status:500 });
    }
    const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    if (!Number.isFinite(amount) || amount < 50) {
      return NextResponse.json({ ok:false, error:'Invalid amount' }, { status:400 });
    }
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency,
      metadata,
      automatic_payment_methods: { enabled: true },
    });
    return NextResponse.json({ ok:true, clientSecret: pi.client_secret });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status:500 });
  }
}

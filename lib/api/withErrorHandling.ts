import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/utils/errors';

type Handler<T> = (req: NextRequest) => Promise<T>;

export function withErrorHandling<T>(handler: Handler<T>) {
  return async (req: NextRequest) => {
    try {
      const data = await handler(req);
      return NextResponse.json({ ok: true, data });
    } catch (e) {
      const message = getErrorMessage(e);
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
  };
}



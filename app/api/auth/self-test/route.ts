import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const names = cookies().getAll().map(c => c.name);
  const hasSb = names.some(n => /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(n));
  return NextResponse.json({ cookieCount: names.length, hasSupabaseAuthCookie: hasSb, names });
}
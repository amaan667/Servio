import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = false;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const timestamp = new Date().toISOString();

    // Print a concise, structured line for Railway logs
    console.log("[AUTH LOG]", JSON.stringify({ timestamp, ...body }));

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[AUTH LOG ERROR]", { message: err?.message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}


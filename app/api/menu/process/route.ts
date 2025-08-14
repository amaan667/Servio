import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { ocrPdfToText } from '@/lib/ocr';
import { isMenuLike } from '@/lib/menuLike';
import { tryParseMenuWithGPT } from '@/lib/safeParse';

export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// replaced by lib/menuLike.ts

export async function POST(req: Request) {
  const supa = admin();
  try {
    const { upload_id } = await req.json();
    if (!upload_id) return NextResponse.json({ ok: false, error: 'upload_id required' }, { status: 400 });

    const { data: row, error } = await supa.from('menu_uploads').select('*').eq('id', upload_id).maybeSingle();
    if (error || !row) {
      console.error('[MENU_PROCESS] fetch upload error', error);
      return NextResponse.json({ ok: false, error: error?.message || 'upload not found' }, { status: 404 });
    }

    const pdfPath = `${row.venue_id}/${row.sha256}.pdf`;
    const { data: file, error: dlErr } = await supa.storage.from('menus').download(pdfPath);
    if (dlErr) {
      console.error('[MENU_PROCESS] storage download error', dlErr);
      return NextResponse.json({ ok: false, error: dlErr.message }, { status: 400 });
    }

    // Prefer native text using pdf-parse (dynamic import to reduce edge size)
    let raw_text = '';
    let pages = 0;
    let ocr_used = false;
    try {
      const pdfParse = (await import('pdf-parse')).default as any;
      const res = await pdfParse(await file.arrayBuffer());
      raw_text = res?.text || '';
      pages = res?.numpages || 0;
    } catch {}

    if (!isMenuLike(raw_text)) {
      // Fallback to OCR of first 5 pages using tesseract.js (simplified, page rasterization omitted here)
      try {
        const text = await ocrPdfToText(Buffer.from(await file.arrayBuffer()), 5);
        if (text) { raw_text = text; ocr_used = true; }
      } catch {}
    }

    // Save raw and basic diagnostics
    await supa.from('menu_uploads').update({ raw_text, ocr_used, pages: pages || null, status: 'processing' }).eq('id', upload_id);
    const len = raw_text?.length || 0;
    const menuLike = isMenuLike(raw_text);
    console.log('[MENU_PROCESS] ocr_len=', len, 'menu_like=', menuLike);

    // If not menu-like, attempt fallback candidate-line GPT parsing
    if (!menuLike) {
      const fallback = await tryParseMenuWithGPT(raw_text);
      console.log('[MENU_PROCESS] fallback_ok=', fallback.ok, 'items=', Array.isArray(fallback.parsed) ? fallback.parsed.length : 0);
      if (fallback.ok) {
        await supa.from('menu_uploads').update({ parsed_json: fallback.parsed, status: 'ready' }).eq('id', upload_id);
        return NextResponse.json({ ok: true, upload_id, parsed: fallback.parsed, usage: null });
      }
      await supa.from('menu_uploads').update({ status: 'needs_review', error: 'Text not menu-like', parsed_json: null }).eq('id', upload_id);
      return NextResponse.json({ ok: false, error: 'Text not menu-like', upload_id });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `You are extracting a structured restaurant/cafe menu from OCR text.\nReturn JSON only as an array of items using this exact schema:\n[ { "category": string, "name": string, "price": number, "description": string|null } ]\nRules:\n- Only include actual purchasable items with a price.\n- Ignore about-us, allergy disclaimers, addresses, contact info, hours, or promotions.\n- Ignore any category descriptions without prices.\n- Merge multi-line item names into one.\n- price is numeric GBP without currency symbols.\n- Infer a category from headings; if none, use "Uncategorized".\n- Do not include any commentary; output JSON only.\nOCR Text (truncated):\n${raw_text.slice(0, 15000)}`;

    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0,
    });
    const content = chat.choices[0].message.content || '{}';
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = []; }
    const usage = (chat as any)?.usage || (chat as any)?.usage_metadata || null;
    console.log('[MENU_PROCESS] gpt tokens:', usage);

    await supa.from('menu_uploads').update({ parsed_json: parsed, status: 'ready' }).eq('id', upload_id);
    return NextResponse.json({ ok: true, upload_id, parsed, usage });
  } catch (e: any) {
    console.error('[MENU_PROCESS] fatal', e);
    return NextResponse.json({ ok: false, error: e?.message || 'process failed' }, { status: 500 });
  }
}



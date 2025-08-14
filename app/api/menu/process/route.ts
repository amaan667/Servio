import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { ocrPdfToText } from '@/lib/ocr';
import { isMenuLike } from '@/lib/menuLike';

export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// replaced by lib/menuLike.ts

const priceG = /(?:£|€|\$)?\s?\d{1,3}(?:[\.,:]\d{2})/g;
function scoreText(text: string): number {
  if (!text) return 0;
  const priceCount = (text.match(priceG) || []).length; // signal of priced lines
  const lengthScore = Math.min(10, Math.floor((text.length || 0) / 400));
  return priceCount + lengthScore;
}

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

    // OCR-first: OCR first 6 pages @ ~200DPI for image-based PDFs
    let ocr_used = true;
    let pages = 0;
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    let ocrText = '';
    try {
      // Our ocr util renders at 220 DPI; still acceptable for 200 DPI target
      ocrText = await ocrPdfToText(pdfBuffer, 6);
      pages = Math.max(pages, 6); // best-effort
    } catch (e) {
      console.error('[MENU_PROCESS] OCR failed, will try native text only', e);
      ocr_used = false;
    }

    // Also attempt native text and select the better scoring text
    let nativeText = '';
    try {
      const pdfParse = (await import('pdf-parse')).default as any;
      const res = await pdfParse(pdfBuffer);
      nativeText = res?.text || '';
      pages = res?.numpages || pages;
    } catch {}

    const ocrScore = scoreText(ocrText);
    const nativeScore = scoreText(nativeText);
    const chosen = nativeScore > ocrScore ? nativeText : ocrText || nativeText;
    ocr_used = nativeScore > ocrScore ? false : ocr_used;
    let raw_text = chosen || ocrText || nativeText || '';

    // Save raw and basic diagnostics
    await supa.from('menu_uploads').update({ raw_text, ocr_used, pages: pages || null, status: 'processing' }).eq('id', upload_id);
    const len = raw_text?.length || 0;
    const menuLike = isMenuLike(raw_text);
    const simpleScore = scoreText(raw_text);
    console.log('[MENU_PROCESS] len=', len, 'menu_like=', menuLike, 'score=', simpleScore, 'ocr_used=', ocr_used, 'ocrScore=', ocrScore, 'nativeScore=', nativeScore);
    console.log('[MENU_PROCESS] preview lines:\n', raw_text.split(/\r?\n/).slice(0, 30).join('\n'));

    // Gate on score < 10 (unless force=true in body)
    let force = false;
    try { const body = await req.clone().json(); force = !!body?.force; } catch {}
    if (simpleScore < 10 && !force) {
      await supa.from('menu_uploads').update({ status: 'needs_review', error: 'Text not menu-like', raw_text }).eq('id', upload_id);
      return NextResponse.json({ ok: false, error: 'Text not menu-like', upload_id });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `You are extracting a structured restaurant/cafe menu from OCR/native text.\nReturn JSON only as an array of items using this exact schema:\n[ { "category": string, "name": string, "description": string|null, "unit_price": number, "available": true } ]\nRules:\n- Only include actual purchasable items with a price.\n- Ignore about-us, allergy disclaimers, addresses, contact info, hours, or promotions.\n- Ignore any category descriptions without prices.\n- Merge multi-line item names into one.\n- unit_price is numeric GBP without currency symbols.\n- Infer a category from headings; if none, use "Uncategorized".\n- available must be true for all returned items.\n- Do not include any commentary; output JSON only.\nSOURCE TEXT (truncated):\n${raw_text.slice(0, 15000)}`;

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

    await supa.from('menu_uploads').update({ parsed_json: parsed, status: 'ready', ocr_used, pages }).eq('id', upload_id);
    return NextResponse.json({ ok: true, upload_id, parsed, usage });
  } catch (e: any) {
    console.error('[MENU_PROCESS] fatal', e);
    return NextResponse.json({ ok: false, error: e?.message || 'process failed' }, { status: 500 });
  }
}



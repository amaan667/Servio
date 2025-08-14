import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const priceRegex = /\b(?:£|GBP)?\s?\d{1,2}(?:[\.:]\d{2})\b/i;

function looksLikeMenu(text: string): boolean {
  return (text?.length || 0) > 300 && priceRegex.test(text);
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

    if (!looksLikeMenu(raw_text)) {
      // Fallback to OCR of first 5 pages using tesseract.js (simplified, page rasterization omitted here)
      try {
        const Tesseract = (await import('tesseract.js')).createWorker as any;
        const worker = await (await import('tesseract.js')).createWorker?.({ logger: () => {} });
        if (worker) {
          await worker.loadLanguage('eng');
          await worker.initialize('eng');
          const { data } = await worker.recognize(await file.arrayBuffer());
          raw_text = data?.text || raw_text;
          await worker.terminate();
          ocr_used = true;
        }
      } catch {}
    }

    // Save raw
    await supa.from('menu_uploads').update({ raw_text, ocr_used, pages: pages || null, status: 'processing' }).eq('id', upload_id);

    // Parse with OpenAI if text looks valid
    if (!looksLikeMenu(raw_text)) {
      return NextResponse.json({ ok: false, error: 'text not menu-like', upload_id });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `You are extracting a structured restaurant/cafe menu from OCR text.\nOutput JSON only in the following schema:\n{ "categories": [ { "name": string, "items": [ { "name": string, "description": string|null, "unit_price": number, "available": true } ] } ] }\n\nRules:\n- Only include actual purchasable items with a price.\n- Ignore any descriptions under a category heading unless they have a price.\n- Merge multi-line item names into one field.\n- Unit price should be numeric GBP without currency symbols.\n- Category names should be inferred from headings or logical grouping.\n- If no category is found, put items under "Uncategorized".\n- Never include page headers/footers, opening hours, or contact details.\n- Example: Under "Beverages", if the text says "Hot and cold drinks served all day" without a price, omit it entirely.\n\nOCR Text:\n${raw_text.slice(0, 15000)}`;

    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0,
    });
    const content = chat.choices[0].message.content || '{}';
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = { categories: [] }; }

    await supa.from('menu_uploads').update({ parsed_json: parsed, status: 'ready' }).eq('id', upload_id);
    return NextResponse.json({ ok: true, upload_id, parsed });
  } catch (e: any) {
    console.error('[MENU_PROCESS] fatal', e);
    return NextResponse.json({ ok: false, error: e?.message || 'process failed' }, { status: 500 });
  }
}



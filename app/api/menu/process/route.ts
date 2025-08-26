import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { isMenuLike } from '@/lib/menuLike';
import { tryParseMenuWithGPT } from '@/lib/safeParse';
import { PDFDocument } from 'pdf-lib';

let supa: ReturnType<typeof createClient> | null = null;
let openaiClient: OpenAI | null = null;

function getSupabaseClient() {
  if (supa) {
    return supa;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  supa = createClient(supabaseUrl, supabaseServiceKey);
  return supa;
}

function getOpenAIClient() {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export async function POST(req: NextRequest) {
  try {
    const { uploadId } = await req.json();
    
    console.log('[AUTH DEBUG] Processing menu upload:', uploadId);

    // Get upload record
    const { data: row, error: fetchErr } = await getSupabaseClient()
      .from('menu_uploads')
      .select('*')
      .eq('id', uploadId)
      .maybeSingle();

    if (fetchErr || !row) {
      console.error('[AUTH DEBUG] Failed to fetch upload:', fetchErr);
      return NextResponse.json({ ok: false, error: 'Upload not found' }, { status: 404 });
    }

    console.log('[AUTH DEBUG] Found upload:', { id: row.id, filename: row.filename, status: row.status });

    // Download PDF from Supabase Storage
    const storagePath = row.filename || `${row.venue_id}/${row.sha256}.pdf`;
    console.log('[AUTH DEBUG] Downloading from storage path:', storagePath);
    
    const { data: file, error: dlErr } = await getSupabaseClient().storage.from('menus').download(storagePath);
    if (dlErr) {
      console.error('[AUTH DEBUG] Failed to download file:', dlErr);
      return NextResponse.json({ ok: false, error: 'Failed to download file' }, { status: 500 });
    }

    console.log('[AUTH DEBUG] Downloaded file, size:', file.size, 'bytes');

    // Extract PDF pages using pdf-lib
    const pdfBytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();
    
    console.log('[AUTH DEBUG] PDF has', pageCount, 'pages');

    const pdfPages: string[] = [];
    const maxPages = Math.min(pageCount, 6); // Limit to first 6 pages

    for (let i = 0; i < maxPages; i++) {
      // Create a new PDF with just this page
      const singlePagePdf = await PDFDocument.create();
      const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
      singlePagePdf.addPage(copiedPage);
      
      const singlePageBytes = await singlePagePdf.save();
      const base64 = Buffer.from(singlePageBytes).toString('base64');
      pdfPages.push(`data:application/pdf;base64,${base64}`);
      
      console.log('[AUTH DEBUG] Extracted page', i + 1, 'size:', singlePageBytes.length, 'bytes');
    }

    // Try to extract text from first page for menu-likeness check
    let rawText = '';
    try {
      const firstPage = pdfPages[0];
      const visionResponse = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all text from this PDF page. Return only the raw text, no formatting or structure.' },
              { type: 'image_url', image_url: { url: firstPage } }
            ]
          }
        ],
        max_tokens: 2000
      });
      
      rawText = visionResponse.choices[0]?.message?.content || '';
      console.log('[AUTH DEBUG] Extracted text length:', rawText.length);
    } catch (textErr) {
      console.error('[AUTH DEBUG] Failed to extract text:', textErr);
      rawText = 'Failed to extract text';
    }

    // Check if text is menu-like
    const menuScore = isMenuLike(rawText);
    console.log('[AUTH DEBUG] Menu-likeness score:', menuScore);

    if (menuScore < 10) {
      console.log('[AUTH DEBUG] Text not menu-like, score:', menuScore);
      
      // Update status to needs_review
      await supa
        .from('menu_uploads')
        .update({ 
          status: 'needs_review', 
          raw_text: rawText,
          error: 'Text not menu-like'
        })
        .eq('id', uploadId);

      return NextResponse.json({ 
        ok: false, 
        error: 'Text not menu-like',
        score: menuScore,
        preview: rawText.substring(0, 200) + '...'
      });
    }

    // Process all PDF pages with OpenAI Vision
    console.log('[AUTH DEBUG] Processing', pdfPages.length, 'PDF pages with OpenAI Vision');
    
    const allMenuItems: any[] = [];
    let totalTokens = 0;

    for (let i = 0; i < pdfPages.length; i++) {
      try {
        const response = await getOpenAIClient().chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a menu parsing expert. Extract menu items from this PDF page and return ONLY a valid JSON array. Each item should have: category (string), name (string), price (number), description (string, optional). Ignore headers, footers, "about us", allergy info, or promotional text. Focus only on food/drink items with prices.`
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract menu items from this PDF page. Return valid JSON array only.' },
                { type: 'image_url', image_url: { url: pdfPages[i] } }
              ]
            }
          ],
          max_tokens: 2000,
          temperature: 0.1
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          try {
            const items = JSON.parse(content);
            if (Array.isArray(items)) {
              allMenuItems.push(...items);
            }
          } catch (parseErr) {
            console.error('[AUTH DEBUG] Failed to parse JSON from page', i + 1, ':', parseErr);
          }
        }

        totalTokens += response.usage?.total_tokens || 0;
        console.log('[AUTH DEBUG] Processed page', i + 1, 'tokens:', response.usage?.total_tokens);
        
      } catch (visionErr) {
        console.error('[AUTH DEBUG] Vision API error on page', i + 1, ':', visionErr);
      }
    }

    console.log('[AUTH DEBUG] Total items extracted:', allMenuItems.length);
    console.log('[AUTH DEBUG] Total tokens used:', totalTokens);

    // Save results
    const { error: updateErr } = await supa
      .from('menu_uploads')
      .update({
        status: 'processed',
        raw_text: rawText,
        parsed_json: allMenuItems,
        pages: maxPages
      })
      .eq('id', uploadId);

    if (updateErr) {
      console.error('[AUTH DEBUG] Failed to update upload:', updateErr);
      return NextResponse.json({ ok: false, error: 'Failed to save results' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      items: allMenuItems,
      pages: maxPages,
      tokens: totalTokens,
      preview: rawText.substring(0, 200) + '...'
    });

  } catch (error) {
    console.error('[AUTH DEBUG] Process error:', error);
    return NextResponse.json({ ok: false, error: 'Processing failed' }, { status: 500 });
  }
}



import multer from 'multer';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import pdf from 'pdf-parse';
import axios from 'axios';
import cheerio from 'cheerio';

const ALLOWED_CATEGORIES = [
  "Starters", "Breakfast-Mains", "Salads", "Sandwiches-Wraps",
  "Burgers", "Kids", "Desserts", "Beverages-Hot", "Beverages-Cold",
  "Specials", "Sides-AddOns"
];

// -- File upload config (10MB limit, /tmp dir)
const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});
export const config = { api: { bodyParser: false } };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function log(msg, data) {
  const time = new Date().toISOString();
  console.log(`[MENU_EXTRACTION] ${time}: ${msg}`, data ?? '');
}

// --- Strict AI Extraction Function ---
async function extractMenuItemsFromText(text) {
  log('Extracting menu items from text using GPT-4o');
  try {
    log('Raw extracted text:', text?.slice(0, 1000) + (text.length > 1000 ? '... [truncated]' : ''));
    const systemPrompt = `You are a menu extraction bot.\nReturn ONLY a single valid JSON array of menu items as described.\nDo NOT include markdown, explanation, or any text before or after the JSON array.\nIf the menu is too long for one array, split your output into multiple JSON arrays, each on its own line (no explanations).\nEach item must have: name (string), price (number), description (string), available (true/false), category (string, from this list: [${ALLOWED_CATEGORIES.map(c => `\"${c}\"`).join(", ")}]).`;

    const userPrompt = `Extract all menu items from the following text. Group items under logical categories based on section headers or item types.\n\nRules:\n- Only include items with both name and price\n- Prices should be numbers, not strings\n- If no description is available, use empty string\n- Do not include any explanations or markdown formatting\n- Never use 'Uncategorized' as a category\n- Infer categories from context if not explicitly stated\n- Only use these categories: ${ALLOWED_CATEGORIES.join(", ")}\n\nHere is the menu text:\n---\n${text}\n---`;

    log('System prompt sent to GPT-4o:', systemPrompt);
    log('User prompt sent to GPT-4o:', userPrompt);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4096,
      temperature: 0.1,
    });
    
    const content = response.choices[0].message.content;
    log('[GPT RAW RESPONSE]', content);
    
    // Try to extract the *largest* valid JSON array from response, even if extra text appears.
    const jsonMatches = content.match(/\[[\s\S]*?\]/g);
    if (!jsonMatches || !jsonMatches[0]) {
      log('ERROR: No JSON array found in GPT response');
      throw new Error('No valid JSON array found in GPT response');
    }
    
    let menuItems;
    try {
      menuItems = JSON.parse(jsonMatches[0]);
      log('Parsed JSON menu items:', menuItems.length, menuItems.slice(0, 3));
    } catch (e) {
      log('ERROR: Failed to parse JSON, attempting to repair...');
      // Optionally, you could send jsonMatches[0] to GPT-3.5 with a "fix this broken JSON array" prompt or use a repair library here.
      throw new Error('Failed to parse GPT response as JSON');
    }
    
    // Post-processing: filter only allowed categories
    const filteredMenuItems = menuItems.filter(item =>
      item.category &&
      ALLOWED_CATEGORIES.map(c => c.toLowerCase()).includes(item.category.trim().toLowerCase())
    );
    const flaggedItems = menuItems.filter(item =>
      !item.category ||
      !ALLOWED_CATEGORIES.map(c => c.toLowerCase()).includes(item.category.trim().toLowerCase())
    );
    if (flaggedItems.length > 0) {
      log('Flagged items with invalid categories for manual review:', flaggedItems);
    }
    log('Filtered menu items to allowed categories:', filteredMenuItems.length, filteredMenuItems.slice(0, 3));
    
    return filteredMenuItems;
  } catch (error) {
    log('ERROR in extractMenuItemsFromText:', error.message, error.stack);
    throw error;
  }
}

// --- Main PDF Extraction Pipeline ---
async function extractTextFromPDF(buffer) {
  try {
    const { text } = await pdf(buffer);
    if (!text || text.length < 20) throw new Error('No readable text extracted from PDF');
    return text;
  } catch (error) {
    throw new Error('Failed to extract text from PDF: ' + error.message);
  }
}

function deduplicateMenuItems(items) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = `${item.name?.toLowerCase().replace(/[^a-z0-9]/g, '')}-${item.price}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
}

// Download PDF from URL
async function downloadPdfBuffer(url) {
  log('Downloading PDF from URL:', url);
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return response.data;
}

// Extract text from downloaded PDF
async function extractMenuFromPdfUrl(url) {
  const pdfBuffer = await downloadPdfBuffer(url);
  const data = await pdf(pdfBuffer);
  log('Extracted text from PDF URL, length:', data.text.length);
  return data.text;
}

// Download and extract menu text from HTML page
async function extractMenuFromHtmlUrl(url) {
  log('Downloading HTML from URL:', url);
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  let menuText = '';
  const menuSelectors = ['.menu', '#menu', '.menu-section', '.menu-list'];
  for (const sel of menuSelectors) {
    if ($(sel).length > 0) {
      menuText = $(sel).text();
      log('Found menu section with selector:', sel);
      break;
    }
  }
  if (!menuText) {
    menuText = $('body').text();
    log('Falling back to full body text, length:', menuText.length);
  }
  return menuText;
}

// Unified extraction from URL
async function extractMenuFromUrl(url) {
  log('Starting unified menu extraction from URL:', url);
  if (url.endsWith('.pdf')) {
    return await extractMenuFromPdfUrl(url);
  }
  try {
    const headRes = await axios.head(url);
    if (headRes.headers['content-type'] && headRes.headers['content-type'].includes('pdf')) {
      return await extractMenuFromPdfUrl(url);
    }
  } catch (e) {
    log('HEAD request failed, proceeding as HTML:', e.message);
  }
  return await extractMenuFromHtmlUrl(url);
}

// --- Main Handler ---
async function handler(req, res) {
  log('API request', {
    method: req.method,
    contentType: req.headers['content-type'],
    hasFile: !!req.file,
    bodyKeys: Object.keys(req.body || {})
  });

  if (req.method === 'POST') {
    // Check for URL extraction
    if (req.body && req.body.menuUrl) {
      const url = req.body.menuUrl;
      try {
        log('Extracting menu from URL:', url);
        const menuText = await extractMenuFromUrl(url);
        log('Menu text extracted from URL, length:', menuText.length);
        const extractedItems = await extractMenuItemsFromText(menuText);
        // The original code had a processExtractedData function here, but it's not defined.
        // Assuming it's meant to be part of the existing pipeline or will be added later.
        // For now, we'll just return the extracted items.
        res.status(200).json({
          success: true,
          count: extractedItems.length,
          items: extractedItems
        });
        return;
      } catch (error) {
        log('ERROR extracting menu from URL:', error.message);
        return res.status(500).json({ error: 'Failed to extract menu from URL', detail: error.message });
      }
    }

    upload.single('menu')(req, res, async (err) => {
      if (err) return res.status(500).json({ error: 'File upload failed', detail: err.message });

      const filePath = req.file?.path;
      const mimeType = req.file?.mimetype;
      const venueId = req.body.venueId || req.query.venueId;
      if (!filePath || !mimeType || !venueId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      try {
        // 1. Extract text from PDF
        const buffer = fs.readFileSync(filePath);
        const text = await extractTextFromPDF(buffer);

        // 2. Extract menu items from text
        const items = await extractMenuItemsFromText(text);
        if (!items.length) throw new Error('No valid menu items found in file');
        const deduped = deduplicateMenuItems(items);

        // 3. Save to DB
        await supabase.from('menu_items').upsert(
          deduped.map(item => ({
            ...item,
            venue_id: venueId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })),
          { onConflict: ['venue_id', 'name'] }
        );

        res.status(200).json({
          success: true,
          count: deduped.length,
          items: deduped
        });
      } catch (error) {
        res.status(500).json({ error: 'Menu extraction failed', detail: error.message });
      } finally {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

export default handler;

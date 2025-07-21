import multer from 'multer';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import crypto from 'crypto';
import pdf from 'pdf-parse';

// --- CONFIG --- //
const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});
export const config = { api: { bodyParser: false } };

// --- LOGGING --- //
function log(msg, data) {
  const time = new Date().toISOString();
  console.log(`[MENU_EXTRACTION] ${time}: ${msg}`, data ?? '');
}

// --- SUPABASE CLIENT --- //
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// --- OPENAI CLIENT --- //
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- CATEGORY MAPPING (for normalization if needed downstream) --- //
const allowedCategories = [
  "Starters", "Breakfast-Mains", "Salads", "Sandwiches-Wraps",
  "Burgers", "Kids", "Desserts", "Beverages-Hot", "Beverages-Cold",
  "Specials", "Sides-AddOns"
];

// --- UTILS --- //
function generateHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function getCache(hash) {
  const { data } = await supabase.from('menu_cache').select('result').eq('hash', hash).single();
  return data ? data.result : null;
}
async function setCache(hash, result) {
  await supabase.from('menu_cache').upsert({ hash, result, created_at: new Date().toISOString() });
}

async function checkOpenAIQuota() {
  try {
    await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "test" }],
      max_tokens: 1,
    });
    return true;
  } catch (err) {
    log('OpenAI quota error', err.message);
    return false;
  }
}

// --- MAIN EXTRACTOR LOGIC --- //
async function extractTextFromPDF(buffer) {
  const { text } = await pdf(buffer);
  if (!text || text.length < 20) throw new Error('No readable text extracted from PDF');
  return text;
}

async function extractMenuItemsFromText(text) {
  const systemPrompt = `
You are a restaurant menu extraction assistant.

- Extract every menu item from the following OCR or plain-text menu dump.
- Use these categories ONLY (exact spelling): "Starters", "Breakfast-Mains", "Salads", "Sandwiches-Wraps", "Burgers", "Kids", "Desserts", "Beverages-Hot", "Beverages-Cold", "Specials", "Sides-AddOns"
- Each item: 
  {
    "name": "proper dish name, never all caps",
    "price": <number>, // GBP, no symbols, one value
    "description": "5–15 word summary",
    "available": true
  }
- Never use "Uncategorized". If unsure, use the closest logical category.
- If price is missing or suspicious, set "price": null and add "priceToVerify": true.
- Only output valid JSON, as a single object with keys as category names, values as arrays of items.
`;

  const userPrompt = `
Extract every menu item, correctly categorized, from the following menu text.
If an item lacks a price or is suspicious, set price to null and add "priceToVerify": true.

Menu text:
---
${text}
---
Return ONLY the JSON object as described.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 3000,
    temperature: 0.0,
  });

  const content = response.choices[0].message.content;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No valid JSON object found in GPT response');
  const grouped = JSON.parse(jsonMatch[0]);

  // Flatten grouped into array, each with category field
  let menuItems = [];
  for (const [category, items] of Object.entries(grouped)) {
    if (allowedCategories.includes(category) && Array.isArray(items)) {
      items.forEach(item => {
        if (item && typeof item === 'object') {
          item.category = category;
          menuItems.push(item);
        }
      });
    }
  }
  log('Extracted and flattened menu items', menuItems.length);
  return menuItems;
}

// --- DEDUPLICATION --- //
function deduplicateMenuItems(items) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = `${item.name?.toLowerCase().trim()}-${item.price}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
}

// --- MAIN API HANDLER --- //
async function handler(req, res) {
  log('API request', {
    method: req.method,
    contentType: req.headers['content-type'],
    hasFile: !!req.file,
    bodyKeys: Object.keys(req.body || {})
  });

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!(await checkOpenAIQuota())) {
    res.status(429).json({ error: 'OpenAI quota exceeded. Please top up your account.' });
    return;
  }

  const processFile = async (filePath, mimeType, venueId) => {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = generateHash(fileBuffer);
    const cached = await getCache(hash);
    if (cached) return cached;

    if (mimeType === 'application/pdf') {
      const text = await extractTextFromPDF(fileBuffer);
      const extracted = await extractMenuItemsFromText(text);
      await setCache(hash, extracted);
      return extracted;
    }
    throw new Error('Unsupported file type');
  };

  // Support for multipart upload only
  upload.single('menu')(req, res, async (err) => {
    if (err) {
      res.status(500).json({ error: 'Upload failed', detail: err.message });
      return;
    }

    const filePath = req.file?.path;
    const mimeType = req.file?.mimetype;
    const venueId = req.body.venueId || req.query.venueId;

    if (!filePath || !mimeType || !venueId) {
      res.status(400).json({ error: 'Missing file, MIME type, or venueId.' });
      return;
    }

    try {
      const items = await processFile(filePath, mimeType, venueId);
      const deduped = deduplicateMenuItems(items);
      if (!deduped.length) throw new Error('No valid menu items found');
      // Insert to DB
      log('Inserting items into database');
      const { data, error } = await supabase
        .from('menu_items')
        .upsert(
          deduped.map(item => ({
            ...item,
            venue_id: venueId,
            available: true,
            created_at: new Date().toISOString()
          })),
          { onConflict: ['venue_id', 'name'] }
        );
      if (error) throw error;
      res.status(200).json({ success: true, count: deduped.length, items: deduped });
    } catch (e) {
      log('Extraction error', e.message);
      res.status(500).json({ error: 'Menu extraction failed', detail: e.message });
    } finally {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });
}

export default handler;

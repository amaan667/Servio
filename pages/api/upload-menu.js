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
// Allowed categories for strict matching
const allowedCategories = [
  "Starters",
  "Breakfast-Mains",
  "Salads",
  "Sandwiches-Wraps",
  "Burgers",
  "Kids",
  "Desserts",
  "Beverages-Hot",
  "Beverages-Cold",
  "Specials",
  "Sides-AddOns"
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

// Extract menu items from text using GPT-4o
async function extractMenuItemsFromText(text) {
  log('Extracting menu items from text using GPT-4o');
  try {
    const systemPrompt = `You are a menu-data curator.\n\nYou will be given raw extracted text from a restaurant menu.\n\nYour job is to return ONLY a valid JSON array, no explanations or extra text.\n\nRules:\n- You MUST use only the following categories as the \"category\" field for each item:\n    [${allowedCategories.map(c => `\"${c}\"`).join(", ")}]\n- If you are unsure, choose the *closest* matching category based on the dish, but never use \"Uncategorized\".\n- Each menu item object must look like this:\n    {\n      \"name\": \"Dish Name (no ALL CAPS, no trailing prices)\",\n      \"price\": <number>, // GBP value, as a number (e.g. 7.5)\n      \"description\": \"Short, clean, under 20 words.\",\n      \"available\": true,\n      \"category\": \"EXACT_CATEGORY\"\n    }\n- Ignore anything that does not match a real menu item (skip headings, random text, etc).\n- Do not output explanations, markdown, or any formatting except valid JSON.\n\nExamples:\n[\n  {\n    \"name\": \"Eggs Benedict\",\n    \"price\": 6.5,\n    \"description\": \"Poached eggs, muffin, hollandaise.\",\n    \"available\": true,\n    \"category\": \"Breakfast-Mains\"\n  },\n  {\n    \"name\": \"Baba Ghanoush\",\n    \"price\": 7.0,\n    \"description\": \"Aubergine, tahini, garlic, bread.\",\n    \"available\": true,\n    \"category\": \"Starters\"\n  },\n  {\n    \"name\": \"Chai Latte\",\n    \"price\": 3.9,\n    \"description\": \"\",\n    \"available\": true,\n    \"category\": \"Beverages-Hot\"\n  }\n]\n\nOnly output a JSON array in this format.`;

    const userPrompt = `Extract all menu items from the following text. Group items under logical categories based on section headers or item types.\n\nRules:\n- Only include items with both name and price\n- Prices should be numbers, not strings\n- If no description is available, use empty string\n- Do not include any explanations or markdown formatting\n- Never use 'Uncategorized' as a category\n- Infer categories from context if not explicitly stated\n- Only use these categories: ${allowedCategories.join(", ")}\n\nHere is the menu text:\n---\n${text}\n---`;

    log('Sending text to GPT-4o for menu extraction');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2048,
      temperature: 0.1,
    });
    
    const content = response.choices[0].message.content;
    log('GPT-4o response received, content length:', content?.length || 0);
    
    // Parse the JSON response
    const jsonMatch = content.match(/\[.*\]/s);
    if (!jsonMatch) {
      log('ERROR: No JSON array found in GPT response');
      throw new Error('No valid JSON array found in GPT response');
    }
    
    let menuItems;
    try {
      menuItems = JSON.parse(jsonMatch[0]);
    } catch (e) {
      log('ERROR: Failed to parse GPT response as JSON:', e.message);
      throw new Error('Failed to parse GPT response as JSON');
    }
    
    // Post-processing: filter only allowed categories
    const filteredMenuItems = menuItems.filter(item =>
      item.category &&
      allowedCategories.map(c => c.toLowerCase()).includes(item.category.trim().toLowerCase())
    );
    const flaggedItems = menuItems.filter(item =>
      !item.category ||
      !allowedCategories.map(c => c.toLowerCase()).includes(item.category.trim().toLowerCase())
    );
    if (flaggedItems.length > 0) {
      log('Flagged items with invalid categories for manual review:', flaggedItems);
    }
    log('Filtered menu items to allowed categories:', filteredMenuItems.length);
    
    return filteredMenuItems;
  } catch (error) {
    log('ERROR in extractMenuItemsFromText:', error.message);
    throw error;
  }
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

import multer from 'multer';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

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
  const systemPrompt = `
You are a menu extraction assistant.

Given a block of menu text from a restaurant PDF, return ONLY a single valid JSON array of objects.

RULES:
- Each object MUST have: name (string), price (number), description (string), available (true), category (one of: ${ALLOWED_CATEGORIES.map(c=>`"${c}"`).join(', ')})
- If you are unsure about category, choose the closest allowed.
- Ignore any section headings.
- Do NOT output markdown, explanations, or anything except the JSON array.

EXAMPLE:
[
  {
    "name": "Eggs Benedict",
    "price": 6.5,
    "description": "Poached eggs, muffin, hollandaise.",
    "available": true,
    "category": "Breakfast-Mains"
  },
  {
    "name": "Chai Latte",
    "price": 3.9,
    "description": "",
    "available": true,
    "category": "Beverages-Hot"
  }
]
`;

  const userPrompt = `Here is the menu text (from a restaurant menu PDF). Extract ALL menu items as per instructions above.

${text}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // or 'gpt-3.5-turbo' if cost-sensitive
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 3500,
    temperature: 0.0,
  });

  const content = response.choices[0].message.content;
  log('AI extraction response:', content);

  // Try to extract the JSON array
  const jsonMatch = content.match(/\[.*\]/s);
  if (!jsonMatch) throw new Error('Model did not return a valid JSON array');

  let menuItems;
  try {
    menuItems = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error('Could not parse JSON array from AI response');
  }

  // Validate & filter
  menuItems = menuItems.filter(item =>
    item.name && typeof item.name === 'string' &&
    typeof item.price === 'number' &&
    item.category && ALLOWED_CATEGORIES.includes(item.category)
  );

  return menuItems;
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

// --- Main Handler ---
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
}

export default handler;

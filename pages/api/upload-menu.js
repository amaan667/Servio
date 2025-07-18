import multer from 'multer';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";

const upload = multer({ dest: '/tmp/uploads' });

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Azure Form Recognizer configuration
const endpoint = "https://servio.cognitiveservices.azure.com/";
const apiKey = "EM4f9JXv8vKUfZZN08RRr64FAXme9bcuLcFvTgnJcJNOH85FpM5GJQQJ99BGACmepeSXJ3w3AAALACOGA1DC";

const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(apiKey));

export async function analyzeMenuWithAzure(filePath) {
  const file = fs.readFileSync(filePath);

  const poller = await client.beginAnalyzeDocument("prebuilt-document", file, {
    contentType: "application/pdf", // or "image/png" etc.
  });

  const result = await poller.pollUntilDone();

  let output = [];

  for (const page of result.pages || []) {
    for (const line of page.lines || []) {
      output.push(line.content);
    }
  }

  return output.join('\n');
}

function cleanOCRLines(rawText) {
  return rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 1);
}

export default function handler(req, res) {
  console.log("🔥 OCR handler loaded: build 2025-07-18@14:02");
  upload.single('menu')(req, res, async (err) => {
    if (err) return res.status(500).json({ error: 'Upload failed' });

    const filePath = req.file.path;
    const mime = req.file.mimetype;
    const venueId = req.body.venueId || req.query.venueId;

    try {
      let text = '';

      // Use Azure Form Recognizer for better OCR
      try {
        text = await analyzeMenuWithAzure(filePath);
        console.log("Azure Form Recognizer extraction successful");
      } catch (azureError) {
        console.error("Azure Form Recognizer failed, falling back to local OCR:", azureError);
        
        // Fallback to local OCR
        if (mime === 'application/pdf') {
          text = await extractTextFromPDF(filePath);
        } else if (mime.startsWith('image/')) {
          text = await extractTextFromImage(filePath);
        } else {
          throw new Error('Unsupported file type');
        }
      }

      // Log the raw OCR text
      console.log("OCR RAW TEXT >>>", text.slice(0, 100));
      console.log("FULL OCR TEXT >>>", text);
      const lines = cleanOCRLines(text);
      const structuredMenu = parseMenuFromSeparatedLines(lines);
      console.log('Structured menu:', structuredMenu);

      if (venueId && structuredMenu.length > 0) {
        await supabase.from('menu_items').delete().eq('venue_id', venueId);
        for (const item of structuredMenu) {
          const { error } = await supabase.from('menu_items').insert({
            name: item.name,
            price: item.price,
            category: item.category || 'Uncategorized',
            venue_id: venueId,
            available: true,
            created_at: new Date().toISOString(),
          });
          if (error) console.error('Supabase insert error:', error);
      }
        return res.status(200).json({ message: 'Menu uploaded successfully' });
      } else {
        return res.status(400).json({ error: 'No menu items found or venueId missing' });
      }
    } catch (e) {
      console.error('OCR error:', e);
      res.status(500).json({ error: 'OCR failed', detail: e.message });
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });
}

async function extractTextFromPDF(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractTextFromImage(imagePath) {
  const worker = await createWorker('eng');
  const { data: { text } } = await worker.recognize(imagePath);
  await worker.terminate();
  return text;
}

function splitMenuSections(text) {
  // Split on likely section/category headers (all caps, possibly with numbers, or lines with only a few words)
  // This is a simple heuristic and can be improved for your menu style
  const lines = text.split('\n');
  const sections = [];
  let currentSection = { category: null, items: [] };
  for (let line of lines) {
    const trimmed = line.trim();
    if (/^[A-Z\s&()]+$/.test(trimmed) && trimmed.length > 2 && trimmed.length < 40) {
      // Likely a section header
      if (currentSection.items.length > 0) sections.push(currentSection);
      currentSection = { category: trimmed, items: [] };
    } else if (trimmed) {
      currentSection.items.push(trimmed);
    }
  }
  if (currentSection.items.length > 0) sections.push(currentSection);
  return sections;
}

async function parseMenuWithHuggingFace(text) {
  const response = await fetch('https://api-inference.huggingface.co/models/ml6team/food-ner', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text }),
  });
  const result = await response.json();
  return result;
}

function groupNEREntities(nerResult) {
  const items = [];
  let currentItem = { name: '', price: null, description: '' };

  for (const entity of nerResult) {
    // If the entity is a price (MONEY or looks like a price)
    if (entity.entity_group === 'MONEY' || /£|\$|\d+\.\d{2}/.test(entity.word)) {
      currentItem.price = parseFloat(entity.word.replace(/[^\d.]/g, ''));
    } else if (entity.entity_group !== 'O') {
      // Treat any non-O entity as a potential name
      if (currentItem.name) {
        items.push({ ...currentItem });
        currentItem = { name: '', price: null, description: '' };
      }
      currentItem.name = entity.word;
    } else {
      // Add to description if not a name or price
      currentItem.description += (currentItem.description ? ' ' : '') + entity.word;
    }
  }
  if (currentItem.name) items.push({ ...currentItem });
  return items.filter(item => item.name);
}

function safeJsonParse(str) {
  const trimmed = (str || '').trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      console.log('safeJsonParse error:', e, 'input:', trimmed);
      return null;
    }
  }
  return null;
}

async function parseMenuWithGPT(text) {
  const nerResult = await parseMenuWithHuggingFace(text);
  console.log('Hugging Face NER result:', nerResult);

  // If the result is a list of lists (NER entities), flatten and group
  if (Array.isArray(nerResult) && Array.isArray(nerResult[0])) {
    const flatEntities = nerResult.flat();
    return groupNEREntities(flatEntities);
  }

  // If the result is a string, check if it's valid JSON before parsing
  if (typeof nerResult === 'string') {
    const trimmed = nerResult.trim();
    console.log('Attempting to parse string as JSON:', trimmed);
    const parsed = safeJsonParse(trimmed);
    if (parsed) {
      return parsed;
    }
    // Otherwise, treat as plain text and use regex fallback
    return extractMenuItemsWithRegex(trimmed);
  }

  // If the result is not useful, try extracting from the original OCR text
  console.log('Falling back to regex extraction from OCR text:', text);
  return extractMenuItemsWithRegex(text);
}

function extractMenuItemsWithRegex(text) {
  let lines = text.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);

  const items = [];
  let lastItem = null;
  const priceOnlyRegex = /^£\s*(\d+(?:\.\d{2})?)$/;
  const menuItemRegex = /^(.*?)(?:\\s*[.\\-–—]*\\s*)?[£€$]?(\\d+[.,]\\d{1,2})/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Case 1: Line is just a price
    const priceOnlyMatch = line.match(priceOnlyRegex);
    if (priceOnlyMatch && lastItem) {
      lastItem.price = parseFloat(priceOnlyMatch[1]);
      items.push(lastItem);
      lastItem = null;
      continue;
    }

    // Case 2: Line has both name and price
    const menuMatch = line.match(menuItemRegex);
    if (menuMatch) {
      items.push({
        name: menuMatch[1].replace(/\s+/g, ' ').trim(),
        price: parseFloat(menuMatch[2]),
      });
      lastItem = null;
      continue;
    }

    // Case 3: Line is a potential item name/description
    if (line.length > 2) {
      // If lastItem exists, push it (no price found)
      if (lastItem) items.push(lastItem);
      lastItem = { name: line, price: null };
    }
  }
  // Push any remaining item
  if (lastItem) items.push(lastItem);

  // Only return items with a name and price
  return items.filter(item => item.name && item.price);
}

// NOTE: Using the GPT API for menu extraction could work better, as it can understand context, group multi-line items, and ignore descriptions/options. However, it is slower, more expensive, and may require prompt engineering for best results. The current parser is rule-based and fast, but less flexible for complex or noisy OCR outputs.

function isLikelyItemName(line) {
  // More lenient item detection - allow Arabic text and special characters
  return (
    line.length > 2 &&
    line.length < 80 &&
    !/^£/.test(line) &&
    !isCategoryHeader(line) &&
    !isDescription(line) &&
    // Allow Arabic text and special characters
    !/^[0-9\s]+$/.test(line) && // Not just numbers and spaces
    // Don't block common food words
    !['served with', 'add ', 'with ', 'and ', 'or '].some(word => 
      line.toLowerCase().startsWith(word)
    )
  );
}

function isCategoryHeader(line) {
  // Expanded list of known categories
  const knownCategories = [
    'STARTERS', 'ALL DAY BRUNCH', 'SALAD', 'WRAPS & SANDWICHES', 
    'ON SOURDOUGH', 'DESSERTS', 'EXTRAS', 'DIPS', 'HOT COFFEE', 
    'ICED COFFEE', 'SPECIALITY COFFEE', 'NOT COFFEE', 'LOOSE LEAVES TEA',
    'JUICES', 'SMOOTHIES', 'MILKSHAKES', 'MATCHA', 'SPECIALS',
    'SLIDERS', 'TACOS', 'MEXICAN RICE', 'NUR MUSHROOM CHICKEN',
    'HOUMOUS JAM', 'GRILLED HALLOUMI', 'KIBBEH', 'MUTBAL'
  ];
  
  return (
    knownCategories.some(cat => line.toUpperCase().includes(cat)) ||
    (line.length > 2 && line.length < 40 && line === line.toUpperCase() && !/^£/.test(line))
  );
}

function isDescription(line) {
  // More lenient description detection
  return (
    /^[a-z]/.test(line) ||
    line.length > 80 ||
    /[.!?]$/.test(line) ||
    line.toLowerCase().includes('served with') ||
    line.toLowerCase().includes('freshly made') ||
    line.toLowerCase().includes('grilled') && line.length > 40
  );
}

function parseMenuFromSeparatedLines(lines) {
  const priceRegex = /£\s?(\d+(?:\.\d{1,2})?)/;
  const menu = [];
  let currentCategory = 'Uncategorized';
  let lastItem = null;
  let incompleteItem = null;
  let pendingPrice = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    console.log(`[Line ${i}] Processing:`, JSON.stringify(line));

    if (isCategoryHeader(line)) {
      currentCategory = line;
      lastItem = null;
      incompleteItem = null;
      pendingPrice = null;
      console.log(`[Line ${i}] Detected category:`, currentCategory);
      continue;
    }

    // If line contains both name and price
    const match = line.match(/^(.*?)[.\-–—]*\s*£\s?(\d+(?:\.\d{1,2})?)/);
    if (match) {
      const name = match[1].trim();
      if (isLikelyItemName(name)) {
        menu.push({
          name,
          price: parseFloat(match[2]),
          category: currentCategory,
        });
        console.log(`[Line ${i}] Paired inline item:`, name, 'with price:', match[2], 'in category:', currentCategory);
      } else {
        console.log(`[Line ${i}] Inline item rejected:`, name);
      }
      lastItem = null;
      incompleteItem = null;
      pendingPrice = null;
      continue;
    }

    // If line is just a price
    const priceMatch = line.match(priceRegex);
    if (priceMatch) {
      pendingPrice = parseFloat(priceMatch[1]);
      console.log(`[Line ${i}] Found price:`, pendingPrice);
      
      // Try to pair with incomplete item first
      if (incompleteItem) {
        menu.push({
          name: incompleteItem.trim(),
          price: pendingPrice,
          category: currentCategory,
        });
        console.log(`[Line ${i}] Paired with incomplete item:`, incompleteItem.trim(), 'price:', pendingPrice);
        incompleteItem = null;
        pendingPrice = null;
        continue;
      }
      
      // Then try with last item
      if (lastItem && isLikelyItemName(lastItem)) {
        menu.push({
          name: lastItem.trim(),
          price: pendingPrice,
          category: currentCategory,
        });
        console.log(`[Line ${i}] Paired with last item:`, lastItem.trim(), 'price:', pendingPrice);
        lastItem = null;
        pendingPrice = null;
        continue;
      }
      
      // If no item found, keep the price pending
      console.log(`[Line ${i}] Price pending, no item to pair with`);
      continue;
    }

    // If line is a likely item name
    if (isLikelyItemName(line)) {
      console.log(`[Line ${i}] Detected item name:`, line);
      // If we have a pending price, pair it with this item
      if (pendingPrice) {
        menu.push({
          name: line.trim(),
          price: pendingPrice,
          category: currentCategory,
        });
        console.log(`[Line ${i}] Paired pending price with new item:`, line.trim(), 'price:', pendingPrice);
        pendingPrice = null;
      } else {
        lastItem = line;
        incompleteItem = line;
        console.log(`[Line ${i}] Buffered item name:`, line);
      }
      continue;
    } else {
      console.log(`[Line ${i}] Not an item name:`, line);
    }

    // If line continues the previous item name (more lenient)
    if (incompleteItem && !isDescription(line) && line.length < 50) {
      // Check if this line looks like it continues the item name
      const isContinuation = (
        /^[a-z]/.test(line) || // starts with lowercase
        /^[A-Z]/.test(line) && line.length < 30 || // starts with uppercase but short
        /^[ء-ي]/.test(line) || // starts with Arabic character
        line.length < 20 // very short line
      );
      
      if (isContinuation) {
        incompleteItem += ' ' + line;
        console.log(`[Line ${i}] Extended incomplete item:`, incompleteItem);
        continue;
  }
    }

    // Skip descriptions
    if (isDescription(line)) {
      console.log(`[Line ${i}] Skipped description:`, line);
      continue;
    }
  }
  
  // Handle any remaining incomplete items
  if (incompleteItem && pendingPrice) {
    menu.push({
      name: incompleteItem.trim(),
      price: pendingPrice,
      category: currentCategory,
    });
    console.log(`Final pairing:`, incompleteItem.trim(), 'with price:', pendingPrice);
  }
  
  console.log('Final menu items:', menu);
  return menu;
} 
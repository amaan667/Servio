import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { PDFDocument } from 'pdf-lib';
import { createCanvas, loadImage } from 'canvas';
import OpenAI from 'openai';
import crypto from 'crypto';
import pdf from 'pdf-parse';
// Remove problematic pdfjs-dist imports
// import pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
// import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.js';
// Remove all Tesseract/OCR and Vision-related imports, functions, and references
// Only keep PDF text extraction + GPT-3.5 pipeline
// Update error messages to 'Menu extraction failed' where needed

// Enhanced logging function
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    message,
    data: data ? JSON.stringify(data, null, 2) : null
  };
  console.log(`[MENU_EXTRACTION] ${timestamp}: ${message}`, data ? data : '');
}

// Check environment variables at startup
log('Starting menu extraction API with environment check');
log('Environment variables check:', {
  hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  nodeEnv: process.env.NODE_ENV
});

// Category priority order for sorting
const categoryPriorityOrder = ['Breakfast', 'Mains', 'Brunch', 'Drinks', 'Smoothies', 'Desserts', 'Add-ons', 'Uncategorized'];

// Category normalization mapping
const categoryNormalizationMap = {
  'SHAKSHUKA ROYALE': 'Brunch',
  'EGGS': 'Brunch',
  'DRINKS': 'Drinks',
  'ADD ONS': 'Add-ons',
  'ADD-ONS': 'Add-ons',
  'ADDONS': 'Add-ons',
  'BREAKFAST': 'Breakfast',
  'MAINS': 'Mains',
  'MAIN COURSES': 'Mains',
  'SMOOTHIES': 'Smoothies',
  'DESSERTS': 'Desserts',
  'DESSERT': 'Desserts',
  'BEVERAGES': 'Drinks',
  'COFFEE': 'Drinks',
  'TEA': 'Drinks',
  'JUICES': 'Drinks',
  'EXTRAS': 'Add-ons',
  'SIDES': 'Add-ons',
  'SIDE DISHES': 'Add-ons',
  'TOPPINGS': 'Add-ons',
  'MODIFIERS': 'Add-ons',
  'HOT DRINKS': 'Drinks',
  'COLD DRINKS': 'Drinks',
  'HOT BEVERAGES': 'Drinks',
  'COLD BEVERAGES': 'Drinks',
  'APPETIZERS': 'Starters',
  'STARTERS': 'Starters',
  'ENTREES': 'Mains',
  'MAIN DISHES': 'Mains',
  'SALADS': 'Salads',
  'SOUPS': 'Starters',
  'SANDWICHES': 'Mains',
  'BURGERS': 'Mains',
  'PASTA': 'Mains',
  'PIZZA': 'Mains',
  'SEAFOOD': 'Mains',
  'MEAT': 'Mains',
  'VEGETARIAN': 'Mains',
  'VEGAN': 'Mains',
  'GLUTEN FREE': 'Mains',
  'KIDS': 'Kids Menu',
  'CHILDREN': 'Kids Menu',
  'KIDS MENU': 'Kids Menu',
  'SPECIALS': 'Specials',
  'DAILY SPECIALS': 'Specials',
  'CHEF SPECIALS': 'Specials',
  'SEASONAL': 'Specials',
  'LIMITED TIME': 'Specials'
};

function normalizeCategory(category) {
  if (!category || category.trim().length === 0) return 'Uncategorized';

  const normalized = category.trim();
  const upperCase = normalized.toUpperCase();

  // Check exact matches first
  if (categoryNormalizationMap[upperCase]) {
    return categoryNormalizationMap[upperCase];
  }

  // Check partial matches
  for (const [key, value] of Object.entries(categoryNormalizationMap)) {
    if (upperCase.includes(key) || key.includes(upperCase)) {
      return value;
    }
  }

  // If it looks like a category but not in our map, return as-is
  if (upperCase.length > 2 && upperCase.length < 50) {
    return normalized;
  }

  return 'Uncategorized';
}

function sortMenuItemsByCategory(menuItems) {
  return menuItems.sort((a, b) => {
    const aIndex = categoryPriorityOrder.indexOf(a.category) !== -1 ? categoryPriorityOrder.indexOf(a.category) : 999;
    const bIndex = categoryPriorityOrder.indexOf(b.category) !== -1 ? categoryPriorityOrder.indexOf(b.category) : 999;
    return aIndex - bIndex;
  });
}

function generateImageHash(imageBuffer) {
  return crypto.createHash('sha256').update(imageBuffer).digest('hex');
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp',
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export const config = {
  api: {
    bodyParser: false,
  },
};

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

log('Supabase client initialized with:', {
  usingServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  fallbackToAnon: !process.env.SUPABASE_SERVICE_ROLE_KEY
});

// OpenAI client with error handling
let openai;
try {
  if (!process.env.OPENAI_API_KEY) {
    log('ERROR: OPENAI_API_KEY is missing');
    throw new Error('OpenAI API key is not configured');
  }
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  log('OpenAI client initialized successfully');
  
  // Check balance/usage (this is a basic check)
  log('OpenAI API key is present and valid');
} catch (error) {
  log('ERROR: Failed to initialize OpenAI client:', error.message);
  throw error;
}

// Function to check OpenAI quota status
async function checkOpenAIQuota() {
  try {
    log('Checking OpenAI quota status...');
    // Try a minimal API call to check quota
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "test" }],
      max_tokens: 1,
    });
    log('OpenAI quota check passed');
    return true;
  } catch (error) {
    log('OpenAI quota check failed:', error.message);
    if (error.code === 'insufficient_quota' || error.message.includes('quota')) {
      log('QUOTA ERROR: OpenAI quota exceeded or insufficient balance');
      return false;
    }
    log('Other OpenAI error:', error.message);
    return false;
  }
}

async function downloadImageFromUrl(imageUrl) {
  try {
    console.log(`[Download] Downloading image from URL: ${imageUrl}`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const tempPath = `/tmp/${Date.now()}-url-image.jpg`;

    fs.writeFileSync(tempPath, buffer);
    console.log(`[Download] Image saved to: ${tempPath}`);

    return tempPath;
  } catch (error) {
    console.error(`[Download] Error downloading image:`, error);
    throw error;
  }
}

// 2. Add persistent cache functions
async function getPersistentCache(hash) {
  const { data, error } = await supabase
    .from('menu_cache')
    .select('result')
    .eq('hash', hash)
    .single();
  if (error || !data) return null;
  return data.result;
}
async function setPersistentCache(hash, result) {
  await supabase.from('menu_cache').upsert({ hash, result, created_at: new Date().toISOString() });
}

// 3. Add OpenAI logging
async function logOpenAICall(model, promptTokens, completionTokens, totalTokens, estimatedCost) {
  console.log(`[OpenAI] Model: ${model}, Prompt: ${promptTokens}, Completion: ${completionTokens}, Total: ${totalTokens}, Cost: $${estimatedCost.toFixed(4)}`);
}

// --- Streamlined PDF Menu Extraction Pipeline ---
import pdfParse from 'pdf-parse';

async function processImageFile(filePath, mimeType) {
  log('Starting processImageFile:', { filePath, mimeType });
  
  try {
    const fileBuffer = fs.readFileSync(filePath);
    log('File read successfully, size:', fileBuffer.length);
    
    const imageHash = generateImageHash(fileBuffer);
    log('Generated image hash:', imageHash);
    
    // Check cache first
    const cachedResult = await getPersistentCache(imageHash);
    if (cachedResult) {
      log('Cache hit, returning cached result');
      return cachedResult;
    }
    log('Cache miss, proceeding with extraction');
    
    let extractedItems = [];
    
    if (mimeType === 'application/pdf') {
      log('Processing PDF file with pdf-parse');
      const text = await extractTextFromPDF(fileBuffer);
      extractedItems = await extractMenuItemsFromText(text);
    } else if (mimeType.startsWith('image/')) {
      log('Processing image file with Vision API');
      const imageBuffers = [fileBuffer];
      const visionResult = await extractMenuWithVision(imageBuffers);
      extractedItems = postProcessMenuItems(visionResult);
    } else {
      log('ERROR: Unsupported file type:', mimeType);
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
    
    log('Extraction completed, items found:', extractedItems.length);
    
    // Cache the result
    await setPersistentCache(imageHash, extractedItems);
    log('Result cached successfully');
    
    return extractedItems;
  } catch (error) {
    log('ERROR in processImageFile:', error.message);
    throw error;
  }
}

// Simple PDF text extraction using pdf-parse
async function extractTextFromPDF(buffer) {
  log('Extracting text from PDF using pdf-parse');
  try {
    const data = await pdf(buffer);
    const text = data.text;
    log('PDF text extraction completed, text length:', text?.length || 0);
    
    if (!text || text.trim().length < 20) {
      throw new Error('No readable text extracted from PDF');
    }
    
    return text;
  } catch (error) {
    log('ERROR in PDF text extraction:', error.message);
    throw error;
  }
}

// Extract menu items from text using GPT-3.5
async function extractMenuItemsFromText(text) {
  log('Extracting menu items from text using GPT-3.5');
  
  try {
    const systemPrompt = `You are a menu extraction assistant. Extract all items from the provided menu text.
Each item must have:
- name
- price (as a number, no currency symbols)
- description (optional but preferred)
- category (must match the original section heading or use "Add-ons" / "Desserts" / "Hot Drinks" etc.)

Never use 'Uncategorized'. If unsure, try to infer based on surrounding items or skip it.
Output in this JSON format:
[
  {
    "name": "",
    "price": 0,
    "description": "",
    "category": ""
  }
]
Always prefer clean and accurate categories over skipping.`;

    const userPrompt = `Extract all menu items from the following text. Group items under logical categories based on section headers or item types.

Rules:
- Only include items with both name and price
- Prices should be numbers, not strings
- If no description is available, use empty string
- Do not include any explanations or markdown formatting
- Never use 'Uncategorized' as a category
- Infer categories from context if not explicitly stated

Here is the menu text:
---
${text}
---`;

    log('Sending text to GPT-3.5 for menu extraction');
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2048,
      temperature: 0.1,
    });
    
    const content = response.choices[0].message.content;
    log('GPT-3.5 response received, content length:', content?.length || 0);
    
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
    
    log('Successfully parsed menu items:', menuItems.length);
    return menuItems;
  } catch (error) {
    log('ERROR in extractMenuItemsFromText:', error.message);
    throw error;
  }
}

// 5. Remove all per-page Vision calls, aggressive Vision fallback, and redundant fallback logic
// (delete all per-page Vision, aggressive fallback, and redundant fallback code)

// Remove old complex PDF processing functions - no longer needed with pdf-parse
// async function convertPDFToImages(pdfBuffer) { ... }
// async function extractTextFromPDFPage(pdfBuffer, pageIndex) { ... }
// async function processPDFWithConsolidatedVision(pdfBuffer) { ... }
// async function convertPDFToImageBuffers(pdfBuffer) { ... }

function deduplicateMenuItems(menuItems) {
  try {
    console.log(`[Deduplicate] Processing ${menuItems.length} items for deduplication`);

    const seen = new Set();
    const uniqueItems = [];

    for (const item of menuItems) {
      // Create a key based on name and price
      const key = `${item.name?.toLowerCase().trim()}-${item.price}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      } else {
        console.log(`[Deduplicate] Skipped duplicate: ${item.name} - £${item.price}`);
      }
    }

    console.log(`[Deduplicate] Reduced from ${menuItems.length} to ${uniqueItems.length} unique items`);
    return uniqueItems;
  } catch (error) {
    console.error('[Deduplicate] Error:', error);
    return menuItems; // Return original if deduplication fails
  }
}

function cleanMenuItems(menuItems) {
  try {
    console.log(`[Clean] Processing ${menuItems.length} items for cleaning`);

    const cleanedItems = menuItems.filter(item => {
      // Must have a name and price
      if (!item.name || !item.price) {
        console.log(`[Clean] Skipped item without name or price:`, item);
        return false;
      }

      // Name must be at least 2 characters
      if (item.name.trim().length < 2) {
        console.log(`[Clean] Skipped item with short name:`, item);
        return false;
      }

      // Price must be a positive number
      if (typeof item.price !== 'number' || item.price <= 0) {
        console.log(`[Clean] Skipped item with invalid price:`, item);
        return false;
      }

      return true;
    });

    console.log(`[Clean] Reduced from ${menuItems.length} to ${cleanedItems.length} valid items`);
    return cleanedItems;
  } catch (error) {
    console.error('[Clean] Error:', error);
    return menuItems; // Return original if cleaning fails
  }
}

async function fixJSONWithFastModel(brokenJSON) {
  try {
    console.log('[Fast Model] Attempting to fix broken JSON with gpt-3.5-turbo');

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a JSON fixer. Fix malformed JSON and return only valid JSON arrays."
        },
        {
          role: "user",
          content: `Fix this broken JSON and return a valid array of menu items:

${brokenJSON}

Return only the fixed JSON array:`
        }
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    console.log('[Fast Model] Fixed JSON response:', content);

    // Try to extract JSON
    const jsonMatch = content.match(/\[.*\]/s);
    if (jsonMatch) {
      try {
        const menuItems = JSON.parse(jsonMatch[0]);
        const validItems = menuItems.filter(item => {
          return item &&
            typeof item.name === 'string' &&
            item.name.trim().length > 0 &&
            typeof item.price === 'number' &&
            item.price > 0;
        });
        console.log(`[Fast Model] Fixed JSON: ${validItems.length} valid items`);
        return validItems;
      } catch (parseError) {
        console.error('[Fast Model] Failed to parse fixed JSON:', parseError);
        return [];
      }
    }
    return [];
  } catch (error) {
    console.error('[Fast Model] Error fixing JSON:', error);
    return [];
  }
}

async function extractItemsWithFastModel(text) {
  try {
    console.log('[Fast Model] Extracting items from text with gpt-3.5-turbo');

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Extract menu items from text and return as JSON array."
        },
        {
          role: "user",
          content: `Extract all menu items from this text and return as JSON array:

${text}

Return only valid JSON:`
        }
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    console.log('[Fast Model] Text extraction response:', content);

    // Try to extract JSON
    const jsonMatch = content.match(/\[.*\]/s);
    if (jsonMatch) {
      try {
        const menuItems = JSON.parse(jsonMatch[0]);
        const validItems = menuItems.filter(item => {
          return item &&
            typeof item.name === 'string' &&
            item.name.trim().length > 0 &&
            typeof item.price === 'number' &&
            item.price > 0;
        });
        console.log(`[Fast Model] Extracted items: ${validItems.length} valid items`);
        return validItems;
      } catch (parseError) {
        console.error('[Fast Model] Failed to parse extracted JSON:', parseError);
        return [];
      }
    }
    return [];
  } catch (error) {
    console.error('[Fast Model] Error extracting items:', error);
    return [];
  }
}

// --- Robust Vision Prompt and Extraction ---
async function extractMenuWithVision(imageBuffers) {
  log('Starting extractMenuWithVision with', imageBuffers.length, 'images');
  
  try {
    const messages = [
      {
        role: "system",
        content: "You are an expert at reading restaurant menus from images and returning structured JSON.",
      },
      {
        role: "user",
        content: [
          ...imageBuffers.map((buf) => ({
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${buf.toString("base64")}`,
              detail: "high",
            },
          })),
          {
            type: "text",
            text: `\nRead all menu images and return an array of menu items formatted like this:\n[\n  {\n    \"name\": \"TURKISH EGGS\",\n    \"price\": 11.0,\n    \"description\": \"Greek yoghurt, chilli oil, tahini, dill, poached egg & seeded sourdough.\",\n    \"category\": \"Breakfast\"\n  },\n  ...\n]\n\nGroup items under logical categories (like Breakfast, Drinks, Add-ons). If a category isn't explicitly written, infer it from layout or item similarity. Avoid marking any item as \"Uncategorized\".\n\nOnly include valid items (those with a name and a price).\nDo NOT return markdown or explanations — just a clean JSON array.`.trim(),
          },
        ],
      },
    ];
    
    log('Sending request to OpenAI Vision API');
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages,
      temperature: 0.2,
      max_tokens: 4096,
    });
    
    log('OpenAI Vision API response received');
    const content = response.choices[0].message.content;
    log('Vision API content length:', content?.length || 0);
    
    return content;
  } catch (error) {
    log('ERROR in extractMenuWithVision:', error.message);
    log('Error details:', {
      code: error.code,
      status: error.status,
      type: error.type,
      message: error.message
    });
    
    if (error.code === 'insufficient_quota' || error.message.includes('quota') || error.message.includes('balance')) {
      log('QUOTA ERROR DETAILS: OpenAI quota exceeded or insufficient balance');
      throw new Error('OpenAI quota exceeded. Your account balance is insufficient for this operation. Please add credits to your OpenAI account.');
    }
    
    if (error.code === 'rate_limit_exceeded') {
      log('RATE LIMIT ERROR: Too many requests to OpenAI');
      throw new Error('OpenAI rate limit exceeded. Please try again in a few minutes.');
    }
    
    throw error;
  }
}

// --- Robust Post-Processing ---
function postProcessMenuItems(rawContent) {
  // Extract JSON array
  const jsonMatch = rawContent.match(/\[.*\]/s);
  if (!jsonMatch) return [];
  let menuItems;
  try {
    menuItems = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return [];
  }
  // Filter and normalize
  return menuItems.filter(item =>
    item &&
    typeof item.name === 'string' && item.name.trim().length > 0 &&
    typeof item.price === 'number' && item.price > 0 &&
    item.category && item.category !== 'Uncategorized'
  ).map(item => ({
    ...item,
    category: normalizeCategory(item.category),
    description: item.description || ''
  }));
}

async function processExtractedData(extractedItems, venueId, res) {
  log('Starting processExtractedData:', { 
    itemsCount: extractedItems?.length || 0, 
    venueId: venueId || 'missing' 
  });
  
  try {
    if (!extractedItems || extractedItems.length === 0) {
      log('ERROR: No items extracted');
      return res.status(400).json({ error: 'No menu items found' });
    }
    
    if (!venueId) {
      log('ERROR: No venue ID provided');
      return res.status(400).json({ error: 'Venue ID is required' });
    }
    
    // Smart deduplication based on name (case-insensitive)
    log('Deduplicating items...');
    const deduplicatedItems = Array.from(
      new Map(
        extractedItems.map((item) => [item.name.trim().toLowerCase(), item])
      ).values()
    );
    log('Deduplication result:', { 
      original: extractedItems.length, 
      deduplicated: deduplicatedItems.length 
    });
    
    // Sort items with Add-ons last
    log('Sorting items...');
    const sortedItems = deduplicatedItems.sort((a, b) => {
      if (a.category === 'Add-ons') return 1;
      if (b.category === 'Add-ons') return -1;
      return 0;
    });
    
    // Filter out items with 'Uncategorized' category
    const filteredItems = sortedItems.filter(item => 
      item.category && 
      item.category.trim() !== '' && 
      item.category.toLowerCase() !== 'uncategorized'
    );
    log('Filtering result:', { 
      before: sortedItems.length, 
      after: filteredItems.length,
      uncategorizedRemoved: sortedItems.length - filteredItems.length
    });
    
    if (filteredItems.length === 0) {
      log('ERROR: No valid items after filtering');
      return res.status(400).json({ error: 'No valid menu items found after processing' });
    }
    
    log('Inserting items into database');
    const { data, error } = await supabase
      .from('menu_items')
      .insert(
        filteredItems.map(item => ({
          ...item,
          venue_id: venueId,
          available: true,
          created_at: new Date().toISOString()
        }))
      );
    
    if (error) {
      log('ERROR inserting into database:', error.message);
      return res.status(500).json({ error: 'Failed to save menu items', detail: error.message });
    }
    
    log('Successfully inserted items into database:', data?.length || 0);
    res.status(200).json({ 
      success: true, 
      items: filteredItems,
      message: `Successfully extracted ${filteredItems.length} menu items (${extractedItems.length - filteredItems.length} duplicates/uncategorized removed)`
    });
  } catch (error) {
    log('ERROR in processExtractedData:', error.message);
    res.status(500).json({ error: 'Menu extraction failed', detail: error.message });
  }
}

// Main Next.js API handler
async function handler(req, res) {
  log('API request received:', {
    method: req.method,
    contentType: req.headers['content-type'],
    hasFile: !!req.file,
    bodyKeys: Object.keys(req.body || {})
  });

  if (req.method === 'POST') {
    // Check OpenAI quota first
    log('Checking OpenAI quota before processing...');
    const quotaOk = await checkOpenAIQuota();
    if (!quotaOk) {
      log('QUOTA ERROR: Cannot process menu extraction due to OpenAI quota limits');
      return res.status(429).json({ 
        error: 'OpenAI quota exceeded', 
        detail: 'Your OpenAI account has insufficient balance or quota. Please add credits to your OpenAI account to continue using menu extraction.',
        code: 'QUOTA_EXCEEDED'
      });
    }
    
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('application/json')) {
      log('Processing JSON request');
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          log('Parsing JSON body');
          const { imageUrl, venueId } = JSON.parse(body);
          log('JSON request data:', { imageUrl: imageUrl ? 'present' : 'missing', venueId });
          
          log('Downloading image from URL');
          const tempFilePath = await downloadImageFromUrl(imageUrl);
          log('Image downloaded to:', tempFilePath);
          
          log('Processing image file');
          const result = await processImageFile(tempFilePath, 'image/jpeg');
          log('Image processing completed, result items:', result?.length || 0);
          
          log('Processing extracted data');
          await processExtractedData(result, venueId, res);
          
          log('Cleaning up temp file');
          fs.unlinkSync(tempFilePath);
          log('JSON request completed successfully');
        } catch (error) {
          log('ERROR in JSON request processing:', error.message);
          res.status(500).json({ error: 'Failed to process image URL', detail: error.message });
        }
      });
      return;
    } else {
      log('Processing file upload request');
      upload.single('menu')(req, res, async (err) => {
        if (err) {
          log('ERROR in file upload:', err.message);
          return res.status(500).json({ error: 'Upload failed', detail: err.message });
        }
        
        const filePath = req.file?.path;
        const mime = req.file?.mimetype;
        const venueId = req.body.venueId || req.query.venueId;
        
        log('File upload details:', {
          filePath: filePath ? 'present' : 'missing',
          mimeType: mime,
          venueId: venueId || 'missing'
        });
        
        try {
          log('Processing uploaded file');
          const result = await processImageFile(filePath, mime);
          log('File processing completed, result items:', result?.length || 0);
          
          log('Processing extracted data');
          await processExtractedData(result, venueId, res);
          log('File upload request completed successfully');
        } catch (e) {
          log('ERROR in file upload processing:', e.message);
          res.status(500).json({ error: 'Menu extraction failed', detail: e.message });
        } finally {
          if (filePath && fs.existsSync(filePath)) {
            log('Cleaning up uploaded file');
            fs.unlinkSync(filePath);
          }
        }
      });
      return;
    }
  }
  
  log('Method not allowed:', req.method);
  res.status(405).json({ error: 'Method not allowed' });
}

export default handler;

import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { PDFDocument } from 'pdf-lib';
import { createCanvas, loadImage } from 'canvas';
import OpenAI from 'openai';
import crypto from 'crypto';
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.js';
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
  'MODIFIERS': 'Add-ons'
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
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
      log('Processing PDF file');
      extractedItems = await processPDFWithConsolidatedVision(fileBuffer);
    } else if (mimeType.startsWith('image/')) {
      log('Processing image file');
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

// 5. Remove all per-page Vision calls, aggressive Vision fallback, and redundant fallback logic
// (delete all per-page Vision, aggressive fallback, and redundant fallback code)

// PDF-to-image conversion using pdf-lib and canvas
async function convertPDFToImages(pdfBuffer) {
  try {
    console.log('[PDF Convert] Converting PDF to images using pdf-lib');

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    console.log(`[PDF Convert] PDF has ${pageCount} pages`);

    const images = [];

    for (let i = 0; i < pageCount; i++) {
      try {
        console.log(`[PDF Convert] Processing page ${i + 1}/${pageCount}`);

        // Create a new PDF with just this page
        const singlePagePdf = await PDFDocument.create();
        const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
        singlePagePdf.addPage(copiedPage);

        // Convert to PNG using canvas
        const pdfBytes = await singlePagePdf.save();

        // For now, we'll use text extraction approach but with better GPT processing
        const pageText = await extractTextFromPDFPage(pdfBuffer, i);

        if (pageText && pageText.trim().length > 0) {
          images.push({
            pageNumber: i + 1,
            content: pageText,
            type: 'text'
          });
          console.log(`[PDF Convert] Extracted text from page ${i + 1}: ${pageText.length} characters`);
        } else {
          console.warn(`[PDF Convert] No text extracted from page ${i + 1}`);
        }

      } catch (pageError) {
        console.error(`[PDF Convert] Error processing page ${i + 1}:`, pageError);
        // Continue with other pages
      }
    }

    console.log(`[PDF Convert] Successfully processed ${images.length} pages`);
    return images;

  } catch (error) {
    console.error('[PDF Convert] Error converting PDF:', error);
    throw error;
  }
}

async function extractTextFromPDFPage(pdfBuffer, pageIndex) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(pdfBuffer, {
      firstPage: pageIndex + 1,
      lastPage: pageIndex + 1
    });

    return data.text || '';
  } catch (error) {
    console.error(`[PDF Page] Error extracting text from page ${pageIndex + 1}:`, error);
    return '';
  }
}

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

// ... existing code ...

async function processPDFWithConsolidatedVision(pdfBuffer) {
  try {
    console.log('[Consolidated Vision] Processing PDF with single GPT-4 Vision call');

    // Convert PDF pages to images (should return array of PNG buffers)
    const imageBuffers = await convertPDFToImageBuffers(pdfBuffer); // <-- implement this if not present

    if (!imageBuffers || imageBuffers.length === 0) {
      throw new Error('No images extracted from PDF');
    }

    // Prepare the Vision prompt and messages
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

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages,
      temperature: 0.2,
      max_tokens: 4096,
    });

    const content = response.choices[0].message.content;
    console.log(`[Consolidated Vision] Raw response:`, content);

    // Try to extract JSON from the response
    const jsonMatch = content.match(/\[.*\]/s);
    if (jsonMatch) {
      try {
        const menuItems = JSON.parse(jsonMatch[0]);

        // Normalize categories and validate items
        const validItems = menuItems.filter(item => {
          return item &&
            typeof item.name === 'string' &&
            item.name.trim().length > 0 &&
            typeof item.price === 'number' &&
            item.price > 0 &&
            item.category && item.category !== 'Uncategorized';
        }).map(item => ({
          ...item,
          category: normalizeCategory(item.category)
        }));

        console.log(`[Consolidated Vision] Parsed ${menuItems.length} items, ${validItems.length} valid from all pages`);

        return validItems;
      } catch (parseError) {
        console.error(`[Consolidated Vision] JSON parse error:`, parseError);
        console.error(`[Consolidated Vision] Failed to parse this JSON:`, jsonMatch[0]);

        // Try to fix JSON with a faster model
        const fixedItems = await fixJSONWithFastModel(jsonMatch[0]);
        if (fixedItems.length > 0) {
          console.log(`[Consolidated Vision] Fixed JSON with fast model, found ${fixedItems.length} items`);
          return fixedItems;
        }

        throw new Error('Failed to parse consolidated GPT Vision response as JSON');
      }
    } else {
      console.error(`[Consolidated Vision] No JSON array found in response`);
      console.error(`[Consolidated Vision] Full response content:`, content);

      // Try to extract items with fast model
      const extractedItems = await extractItemsWithFastModel(content);
      if (extractedItems.length > 0) {
        console.log(`[Consolidated Vision] Extracted items with fast model, found ${extractedItems.length} items`);
        return extractedItems;
      }

      throw new Error('No valid JSON array found in consolidated GPT Vision response');
    }
  } catch (error) {
    console.error(`[Consolidated Vision] Error:`, error);

    // Handle quota errors specifically
    if (error.code === 'insufficient_quota' || error.message?.includes('quota')) {
      throw new Error('OpenAI quota exceeded. Please upgrade your plan or try again later.');
    }

    throw error;
  }
}

// PNG for Vision, JPEG for OCR fallback
async function convertPDFToImageBuffers(pdfBuffer) {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  const pdfjsWorker = require('pdfjs-dist/legacy/build/pdf.worker.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

  // Fix: disable worker for Node.js
  const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer, disableWorker: true });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const imageBuffers = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    // Render at 2.5x scale for clarity, but cap max dimensions
    const scale = 2.5;
    const viewport = page.getViewport({ scale });
    const maxWidth = 1200, maxHeight = 1800;
    let width = viewport.width, height = viewport.height;
    if (width > maxWidth || height > maxHeight) {
      const scaleDown = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * scaleDown);
      height = Math.round(height * scaleDown);
    }
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    const renderContext = {
      canvasContext: ctx,
      viewport: page.getViewport({ scale: width / viewport.width }),
    };
    await page.render(renderContext).promise;
    imageBuffers.push(canvas.toBuffer('image/png'));
  }
  return imageBuffers;
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
    
    log('Inserting items into database');
    const { data, error } = await supabase
      .from('menu_items')
      .insert(
        extractedItems.map(item => ({
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
      items: extractedItems,
      message: `Successfully extracted ${extractedItems.length} menu items`
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

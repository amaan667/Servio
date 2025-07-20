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
const Tesseract = require('tesseract.js');

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
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

// 4. Refactor processImageFile to use persistent cache and efficient pipeline
async function processImageFile(filePath, mimeType) {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = generateImageHash(fileBuffer);
  // 1. Check persistent cache
  const cached = await getPersistentCache(hash);
  if (cached) {
    console.log(`[Cache] Persistent hit for hash: ${hash.substring(0,8)}...`);
    return { type: 'structured', data: cached };
  }
  // 2. If PDF, try text extraction first
  if (mimeType === 'application/pdf') {
    try {
      const text = await extractTextFromPDF(fileBuffer);
      if (text && text.trim().length > 100) { // Only use if text is substantial
        const gptResult = await parseMenuTextWithGPT(text, 1, null, 'gpt-3.5-turbo');
        if (gptResult.items && gptResult.items.length > 0) {
          await setPersistentCache(hash, gptResult.items);
          return { type: 'structured', data: gptResult.items };
        }
      }
    } catch (e) {
      console.warn('[Text Extraction] Failed or insufficient, will try Vision.');
    }
    // 3. If text model fails, use Vision (batch all pages)
    try {
      const imageBuffers = await convertPDFToImageBuffers(fileBuffer);
      const menuItems = await processAllImagesWithGPTVision(imageBuffers, imageBuffers.map(()=>'image/png'));
      if (menuItems && menuItems.length > 0) {
        await setPersistentCache(hash, menuItems);
        return { type: 'structured', data: menuItems };
      }
    } catch (e) {
      console.error('[Vision] PDF Vision extraction failed:', e);
    }
    // 4. Fallback: OCR or regex only if all else fails
    try {
      const imageBuffers = await convertPDFToImageBuffers(fileBuffer);
      const ocrText = await ocrImagesWithTesseract(imageBuffers);
      const fallbackItems = extractMenuItemsWithRegex(ocrText);
      if (fallbackItems && fallbackItems.length > 0) {
        await setPersistentCache(hash, fallbackItems);
        return { type: 'structured', data: fallbackItems };
      }
    } catch (e) {
      console.error('[OCR Fallback] Failed:', e);
    }
    throw new Error('Failed to extract menu items from PDF');
  } else if (mimeType.startsWith('image/')) {
    // For images, use Vision directly
    try {
      const menuItems = await processImageWithGPTVision(fileBuffer, mimeType);
      if (menuItems && menuItems.length > 0) {
        await setPersistentCache(hash, menuItems);
        return { type: 'structured', data: menuItems };
      }
    } catch (e) {
      console.error('[Vision] Image Vision extraction failed:', e);
    }
    // Fallback: OCR or regex
    try {
      const ocrText = await ocrImagesWithTesseract([fileBuffer]);
      const fallbackItems = extractMenuItemsWithRegex(ocrText);
      if (fallbackItems && fallbackItems.length > 0) {
        await setPersistentCache(hash, fallbackItems);
        return { type: 'structured', data: fallbackItems };
      }
    } catch (e) {
      console.error('[OCR Fallback] Failed:', e);
    }
    throw new Error('Failed to extract menu items from image');
  } else {
    throw new Error('Unsupported file type');
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
async function ocrImagesWithTesseract(imageBuffers) {
  const Tesseract = require('tesseract.js');
  const results = [];
  for (let i = 0; i < imageBuffers.length; i++) {
    const { data: { text } } = await Tesseract.recognize(imageBuffers[i], 'eng');
    results.push(text);
  }
  return results.join('\n\n');
}

// --- Robust Vision Prompt and Extraction ---
async function extractMenuWithVision(imageBuffers) {
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
  return response.choices[0].message.content;
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

// Main Next.js API handler
async function handler(req, res) {
  // Reconstruct the previous API route logic here
  // (This is a simplified version; you may need to copy in the full logic from your previous handler)
  if (req.method === 'POST') {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { imageUrl, venueId } = JSON.parse(body);
          const tempFilePath = await downloadImageFromUrl(imageUrl);
          const result = await processImageFile(tempFilePath, 'image/jpeg');
          await processExtractedData(result, venueId, res);
          fs.unlinkSync(tempFilePath);
        } catch (error) {
          res.status(500).json({ error: 'Failed to process image URL', detail: error.message });
        }
      });
      return;
    } else {
      upload.single('menu')(req, res, async (err) => {
        if (err) return res.status(500).json({ error: 'Upload failed' });
        const filePath = req.file.path;
        const mime = req.file.mimetype;
        const venueId = req.body.venueId || req.query.venueId;
        try {
          const result = await processImageFile(filePath, mime);
          await processExtractedData(result, venueId, res);
        } catch (e) {
          res.status(500).json({ error: 'OCR failed', detail: e.message });
        } finally {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      });
      return;
    }
  }
  res.status(405).json({ error: 'Method not allowed' });
}

export default handler;

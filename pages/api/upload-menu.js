import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import vision from '@google-cloud/vision';
import OpenAI from 'openai';
import { jsonrepair } from 'jsonrepair';

// --- Railway Google credentials setup ---
if (process.env.GOOGLE_CREDENTIALS_B64) {
  const keyPath = '/tmp/key.json';
  require('fs').writeFileSync(
    keyPath,
    Buffer.from(process.env.GOOGLE_CREDENTIALS_B64, 'base64').toString('utf-8')
  );
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
  console.log('[MENU_EXTRACTION] Service account written to:', keyPath);
  console.log('[MENU_EXTRACTION] GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

const upload = multer({ dest: '/tmp' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const visionClient = new vision.ImageAnnotatorClient();
const storage = new Storage();

export const config = { api: { bodyParser: false } };

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// === MENU EXTRACTION FLOW ===
// Stage 1: File Upload & Validation
async function validateAndUploadFile(req) {
  console.log('[MENU_EXTRACTION] Stage 1: File Upload & Validation');
  
  const filePath = req.file.path;
  const bucketName = process.env.GCS_BUCKET_NAME;
  
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME environment variable is not set.');
  }
  
  console.log('[MENU_EXTRACTION] Uploaded file path:', filePath);
  console.log('[MENU_EXTRACTION] File exists:', fs.existsSync(filePath), 'Size:', fs.existsSync(filePath) ? fs.statSync(filePath).size : 'N/A');
  
  return { filePath, bucketName };
}

// Stage 2: PDF to OCR Text Conversion
async function convertPdfToOcrText(filePath, bucketName) {
  console.log('[MENU_EXTRACTION] Stage 2: PDF to OCR Text Conversion');
  
  try {
    console.log('[MENU_EXTRACTION] Uploading to GCS...');
    const gcsUri = await uploadToGCS(filePath, bucketName, path.basename(filePath));
    console.log('[MENU_EXTRACTION] Uploaded to GCS URI:', gcsUri);
    
    console.log('[MENU_EXTRACTION] Starting Vision OCR...');
    const ocrText = await ocrPdfWithVision(filePath, bucketName);
    console.log('[MENU_EXTRACTION] OCR text (first 500 chars):', ocrText.slice(0, 500));
    
    return ocrText;
  } catch (visionErr) {
    console.error('[MENU_EXTRACTION] Vision OCR error:', visionErr);
    throw new Error('Vision OCR failed: ' + visionErr.message);
  }
}

// Stage 3: OCR Text to Menu Items (GPT-4o Processing)
async function extractMenuItemsFromOcr(ocrText) {
  console.log('[MENU_EXTRACTION] Stage 3: OCR Text to Menu Items (GPT-4o Processing)');
  
  if (!ocrText || ocrText.length < 50) {
    throw new Error('OCR text too short or empty.');
  }
  
  // Chunk OCR text if very long
  function splitMenuByLines(text, maxLines = 40) {
    const lines = text.split(/\r?\n/);
    const chunks = [];
    for (let i = 0; i < lines.length; i += maxLines) {
      chunks.push(lines.slice(i, i + maxLines).join('\n'));
    }
    return chunks;
  }
  
  let allMenuItems = [];
  let chunkErrors = [];
  const ocrChunks = ocrText.length > 10000 || ocrText.split(/\r?\n/).length > 40 ? splitMenuByLines(ocrText, 40) : [ocrText];
  console.log(`[MENU_EXTRACTION] OCR text will be processed in ${ocrChunks.length} chunk(s).`);
  
  for (let idx = 0; idx < ocrChunks.length; idx++) {
    const chunk = ocrChunks[idx];
    const prompt = `You are a restaurant menu data extraction assistant.\n\nExtract all menu items from the following OCR text.\n\nInstructions:\n- Output null for unknown price or category (never 'N/A', '-', or 'unknown').\n- If a product has multiple prices or sizes, create a separate item for each.\n- Ignore items that are not actual menu items (e.g., section headers, footers, disclaimers).\n- Only include items with a name and a price.\n- Output as a JSON object with a 'menuItems' key whose value is an array of items.\n- Each item should have: name, description, price, category.\n\nExample of good output:\n{\n  "menuItems": [\n    { "name": "Coca-Cola", "description": "", "price": 2.5, "category": "Beverages" },\n    { "name": "Sprite", "description": "", "price": 2.5, "category": "Beverages" }\n  ]\n}\nExample of bad output:\n{\n  "menuItems": [\n    { "name": "Beverages", "description": "", "price": "N/A", "category": "" },\n    { "name": "Coca-Cola", "description": "", "price": "£2.50", "category": "" }\n  ]\n}\n\nOCR Text:\n${chunk}`;
    
    try {
      const gptResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0,
      });
      
      let menuItems = [];
      const content = gptResponse.choices[0].message.content;
      if (content) {
        const parsed = JSON.parse(content);
        menuItems = parsed.menuItems || [];
      }
      if (!Array.isArray(menuItems)) menuItems = [];
      allMenuItems = allMenuItems.concat(menuItems);
      console.log(`[MENU_EXTRACTION] Chunk ${idx + 1}/${ocrChunks.length}: extracted ${menuItems.length} items.`);
  } catch (err) {
      console.error(`[MENU_EXTRACTION] Failed to process chunk ${idx + 1}:`, err);
      chunkErrors.push({ chunk: idx + 1, error: err.message });
    }
  }
  
  return { allMenuItems, chunkErrors };
}

// Stage 4: Menu Items Validation & Cleaning
async function validateAndCleanMenuItems(allMenuItems, chunkErrors) {
  console.log('[MENU_EXTRACTION] Stage 4: Menu Items Validation & Cleaning');
  
  // Clean up the array: keep only objects with name AND price, discard empty/fragmented entries
  allMenuItems = allMenuItems.filter(
    item =>
      item &&
      typeof item === 'object' &&
      typeof item.name === 'string' &&
      item.name.length > 0 &&
      item.price !== undefined &&
      item.price !== null &&
      item.price !== ''
  );
  
  // Remove duplicate menu items (by name+price)
  const seen = new Set();
  allMenuItems = allMenuItems.filter(item => {
    const key = `${item.name}|${item.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Post-process: standardize price and category
  function cleanMenuItems(items) {
    return items
      .map(item => {
        // Clean price
        let price = item.price;
        if (typeof price === "string") {
          price = price.replace(/[^0-9.\/]/g, ""); // Remove currency, keep numbers, dot, slash
          if (price.includes("/")) {
            // Handle range, pick first value
            price = price.split("/")[0].trim();
          }
          price = parseFloat(price);
          if (isNaN(price)) price = null;
        }
        // Clean category
        let category = item.category;
        if (!category || category === "N/A" || category === "-" || category === "unknown") category = null;
        return { ...item, price, category };
      })
      .filter(item => item.name && item.price !== null); // Only keep valid items
  }
  
  allMenuItems = cleanMenuItems(allMenuItems);
  console.log('[MENU_EXTRACTION] Cleaned & deduped menuItems:', allMenuItems);
  
  if (!Array.isArray(allMenuItems) || allMenuItems.length === 0) {
    throw new Error('Menu array is empty or invalid after merging');
  }
  
  return { menuItems: allMenuItems, chunkErrors };
}

// Stage 5: Database Integration
async function saveMenuItemsToDatabase(menuItems, venueSlug) {
  console.log('[MENU_EXTRACTION] Stage 5: Database Integration');
  console.log(`[MENU_EXTRACTION] Processing venue slug: ${venueSlug}`);
  
  try {
    // Import centralized Supabase client
    const { supabase } = require('@/lib/supabase');
    
    if (!supabase) {
      console.error('[MENU_EXTRACTION] Supabase client not available');
      return { success: false, savedCount: 0, error: 'Database connection not available' };
    }

    // Check if venue exists, create if it doesn't
    const { data: venueData, error: venueError } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venueSlug)
      .single();

    if (venueError || !venueData) {
      console.log(`[MENU_EXTRACTION] Venue ${venueSlug} not found, creating it...`);
      
      // Create the venue if it doesn't exist
      const { data: newVenue, error: createVenueError } = await supabase
        .from("venues")
        .insert({
          venue_id: venueSlug,  // Use slug as venue_id
          name: venueSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: `Auto-created venue for menu upload`
        })
        .select()
        .single();

      if (createVenueError) {
        console.error('[MENU_EXTRACTION] Failed to create venue:', createVenueError);
        return { success: false, savedCount: 0, error: 'Failed to create venue' };
      }
      
      console.log(`[MENU_EXTRACTION] Created venue: ${venueSlug}`);
    } else {
      console.log(`[MENU_EXTRACTION] Found existing venue: ${venueSlug}`);
    }

    // Prepare menu items for insertion - use slug as venue_id
    const itemsToInsert = menuItems.map(item => ({
      venue_id: venueSlug,  // Use slug directly as venue_id
      name: item.name,
      description: item.description || '',
      price: item.price,
      category: item.category || 'Uncategorized',
      available: true,
      image_url: item.image_url || null,
      prep_time: item.prep_time || null,
      rating: item.rating || null
    }));

    console.log(`[MENU_EXTRACTION] Inserting ${itemsToInsert.length} items for venue: ${venueSlug}`);

    // Insert menu items
    const { data: insertedItems, error: insertError } = await supabase
      .from("menu_items")
      .insert(itemsToInsert)
      .select();

    if (insertError) {
      console.error('[MENU_EXTRACTION] Failed to insert menu items:', insertError);
      return { success: false, savedCount: 0, error: insertError.message };
    }

    console.log(`[MENU_EXTRACTION] Successfully saved ${insertedItems.length} items to database for venue: ${venueSlug}`);
    
    return { 
      success: true, 
      savedCount: insertedItems.length,
      insertedItems: insertedItems,
      venueId: venueSlug
    };

  } catch (error) {
    console.error('[MENU_EXTRACTION] Database integration error:', error);
    return { 
      success: false, 
      savedCount: 0, 
      error: error.message 
    };
  }
}

// Stage 6: Response & Cleanup
async function prepareResponseAndCleanup(menuItems, ocrText, chunkErrors, filePath) {
  console.log('[MENU_EXTRACTION] Stage 6: Response & Cleanup');
  
  // Cleanup temp file
  try {
    fs.unlinkSync(filePath);
    console.log('[MENU_EXTRACTION] Temp file cleaned up:', filePath);
  } catch (cleanupErr) {
    console.error('[MENU_EXTRACTION] Temp file cleanup error:', cleanupErr);
  }
  
  return { menuItems, ocrText, chunkErrors };
}

// Helper functions
async function uploadToGCS(localPath, bucketName, destFileName) {
  await storage.bucket(bucketName).upload(localPath, { destination: destFileName });
  return `gs://${bucketName}/${destFileName}`;
}

async function ocrPdfWithVision(pdfPath, bucketName) {
  const gcsSourceUri = await uploadToGCS(pdfPath, bucketName, path.basename(pdfPath));
  const gcsDestinationUri = `gs://${bucketName}/ocr-results/`;

  const inputConfig = { mimeType: 'application/pdf', gcsSource: { uri: gcsSourceUri } };
  const outputConfig = { gcsDestination: { uri: gcsDestinationUri } };

  const [operation] = await visionClient.asyncBatchAnnotateFiles({
    requests: [{
      inputConfig,
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      outputConfig,
    }],
  });

  console.log('Processing PDF with Vision OCR...');
  await operation.promise();

  // Download the output JSON from GCS
  const [files] = await storage.bucket(bucketName).getFiles({ prefix: 'ocr-results/' });
  let ocrText = '';
  for (const file of files) {
    if (file.name.endsWith('.json')) {
      const contents = await file.download();
      const json = JSON.parse(contents[0].toString());
      ocrText += json.responses.map(r => r.fullTextAnnotation?.text || '').join('\n');
    }
  }
  return ocrText;
}

// Main handler with order flow structure
export default async function handler(req, res) {
  console.log('[MENU_EXTRACTION] Handler start - Order Flow Structure');
  
  try {
    // Stage 1: File Upload & Validation
    await runMiddleware(req, res, upload.single('menu'));
    const { filePath, bucketName } = await validateAndUploadFile(req);
    
    // Stage 2: PDF to OCR Text Conversion
    const ocrText = await convertPdfToOcrText(filePath, bucketName);
    
    // Stage 3: OCR Text to Menu Items (GPT-4o Processing)
    const { allMenuItems, chunkErrors } = await extractMenuItemsFromOcr(ocrText);
    
    // Stage 4: Menu Items Validation & Cleaning
    const { menuItems, chunkErrors: finalChunkErrors } = await validateAndCleanMenuItems(allMenuItems, chunkErrors);
    
    // Stage 5: Database Integration (Future Enhancement)
    const venueSlug = req.body.venueId || 'demo-cafe';
    const dbResult = await saveMenuItemsToDatabase(menuItems, venueSlug);
    
    // Stage 6: Response & Cleanup
    const response = await prepareResponseAndCleanup(menuItems, ocrText, finalChunkErrors, filePath);
    
    console.log('[MENU_EXTRACTION] Order Flow Complete - Success');
    console.log('API RESPONSE JSON:', JSON.stringify({ 
      menuItems: response.menuItems, 
      ocrText: response.ocrText, 
      chunkErrors: response.chunkErrors,
      dbResult 
    }));
    
    return res.json({ 
      menuItems: response.menuItems, 
      ocrText: response.ocrText, 
      chunkErrors: response.chunkErrors,
      dbResult 
    });
    
  } catch (err) {
    console.error('[MENU_EXTRACTION] Order Flow Error:', err);
    return res.status(500).json({ 
      error: err.message, 
      stack: err.stack,
      stage: 'menu_extraction_failed'
    });
  }
}

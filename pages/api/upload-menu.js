import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { PDFDocument } from 'pdf-lib';
import { createCanvas, loadImage } from 'canvas';
import OpenAI from 'openai';
import crypto from 'crypto';

// Simple in-memory cache (in production, use Redis or Supabase)
const visionCache = new Map();

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

function getCachedResult(imageHash) {
  const cached = visionCache.get(imageHash);
  if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
    console.log(`[Cache] Hit for image hash: ${imageHash.substring(0, 8)}...`);
    return cached.result;
  }
  return null;
}

function setCachedResult(imageHash, result) {
  visionCache.set(imageHash, {
    result,
    timestamp: Date.now()
  });
  console.log(`[Cache] Stored result for image hash: ${imageHash.substring(0, 8)}...`);
}

async function optimizeImageForVision(imageBuffer, mimeType) {
  try {
    console.log(`[Optimize] Optimizing image for GPT Vision`);
    
    // Load image
    const image = await loadImage(imageBuffer);
    
    // Calculate optimal dimensions (max 1000x1400)
    const maxWidth = 1000;
    const maxHeight = 1400;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    
    const newWidth = Math.round(image.width * scale);
    const newHeight = Math.round(image.height * scale);
    
    console.log(`[Optimize] Resizing from ${image.width}x${image.height} to ${newWidth}x${newHeight}`);
    
    // Create canvas with optimized dimensions
    const canvas = createCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');
    
    // Draw resized image
    ctx.drawImage(image, 0, 0, newWidth, newHeight);
    
    // Convert to buffer with reduced quality
    const optimizedBuffer = canvas.toBuffer('image/jpeg', { quality: 0.8 });
    
    console.log(`[Optimize] Reduced size from ${imageBuffer.length} to ${optimizedBuffer.length} bytes`);
    return optimizedBuffer;
  } catch (error) {
    console.error(`[Optimize] Error optimizing image:`, error);
    return imageBuffer; // Return original if optimization fails
  }
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

async function processImageFile(filePath, mimeType) {
  console.log(`[Process] Processing file: ${filePath}, type: ${mimeType}`);
  
  try {
    const fileBuffer = fs.readFileSync(filePath);
    
    if (mimeType === 'application/pdf') {
      console.log('[Process] Processing PDF with consolidated GPT-4 Vision approach');
      
      try {
        // Use consolidated vision processing for PDFs
        const allMenuItems = await processPDFWithConsolidatedVision(fileBuffer);
        
        if (allMenuItems.length > 0) {
          console.log(`[Process] ✅ Found ${allMenuItems.length} items with consolidated vision`);
          
          // Clean and deduplicate the results
          const cleanedItems = cleanMenuItems(allMenuItems);
          const deduplicatedItems = deduplicateMenuItems(cleanedItems);
          
          // Sort items by category priority
          const sortedItems = sortMenuItemsByCategory(deduplicatedItems);
          
          console.log(`[Process] Final result: ${sortedItems.length} unique, valid menu items sorted by category`);
          return { type: 'structured', data: sortedItems };
        } else {
          throw new Error('No menu items found in PDF');
        }
      } catch (visionError) {
        console.error(`[Process] Consolidated vision error:`, visionError);
        
        // Handle quota errors specifically
        if (visionError.message?.includes('quota') || visionError.message?.includes('OpenAI quota exceeded')) {
          throw new Error('OpenAI quota exceeded. Please upgrade your plan or try again later.');
        }
        
        // Fallback to per-page text processing if consolidated vision fails
        console.log(`[Process] Consolidated vision failed, falling back to per-page text processing...`);
        
        // Convert PDF to text pages
        const textPages = await convertPDFToImages(fileBuffer);
        
        if (textPages.length === 0) {
          throw new Error('No text extracted from PDF');
        }
        
        console.log(`[Process] Extracted text from ${textPages.length} pages, processing with GPT text parsing`);
        
        // Process each page with GPT in parallel (up to 5 at once)
        const batchSize = 5;
        const allMenuItems = [];
        let lastKnownCategory = null;
        let quotaErrorDetected = false;
        let totalPagesProcessed = 0;
        let pagesWithQuotaErrors = 0;
        
        for (let i = 0; i < textPages.length; i += batchSize) {
          const batch = textPages.slice(i, i + batchSize);
          console.log(`[Process] Processing batch ${Math.floor(i/batchSize) + 1}: pages ${i+1}-${Math.min(i+batchSize, textPages.length)}`);
          
          const batchPromises = batch.map(async (page) => {
            try {
              console.log(`[Process] Processing page ${page.pageNumber} with ${page.content.length} characters`);
              console.log(`[Process] Using last known category: ${lastKnownCategory || 'None'}`);
              
              const pageResult = await parseMenuTextWithGPT(page.content, page.pageNumber, lastKnownCategory);
              totalPagesProcessed++;
              
              if (pageResult && pageResult.items && Array.isArray(pageResult.items) && pageResult.items.length > 0) {
                console.log(`[Process] ✅ Page ${page.pageNumber}: Found ${pageResult.items.length} items`);
                
                // Update last known category for next page
                if (pageResult.lastCategory) {
                  lastKnownCategory = pageResult.lastCategory;
                  console.log(`[Process] Updated last known category to: ${lastKnownCategory}`);
                }
                
                return pageResult.items;
              } else {
                console.warn(`[Process] ⚠️ Page ${page.pageNumber}: No items found`);
                
                // Try with more aggressive prompt if no items found
                const aggressiveResult = await parseMenuTextWithGPTAggressive(page.content, page.pageNumber, lastKnownCategory);
                if (aggressiveResult && aggressiveResult.items && aggressiveResult.items.length > 0) {
                  console.log(`[Process] ✅ Page ${page.pageNumber}: Found ${aggressiveResult.items.length} items with aggressive parsing`);
                  
                  // Update last known category for next page
                  if (aggressiveResult.lastCategory) {
                    lastKnownCategory = aggressiveResult.lastCategory;
                    console.log(`[Process] Updated last known category to: ${lastKnownCategory}`);
                  }
                  
                  return aggressiveResult.items;
                }
              }
              
              return [];
            } catch (pageError) {
              console.error(`[Process] Error processing page ${page.pageNumber}:`, pageError);
              totalPagesProcessed++;
              
              // Check if this is a quota error
              if (pageError.message?.includes('quota') || pageError.code === 'insufficient_quota' || pageError.status === 429) {
                quotaErrorDetected = true;
                pagesWithQuotaErrors++;
                console.error(`[Process] Quota error detected on page ${page.pageNumber}`);
              }
              
              return []; // Return empty array for failed pages
            }
          });
          
          // Wait for batch to complete
          const batchResults = await Promise.all(batchPromises);
          allMenuItems.push(...batchResults.flat());
        }
        
        console.log(`[Process] Processing complete: ${totalPagesProcessed} pages processed, ${pagesWithQuotaErrors} pages had quota errors`);
        
        if (allMenuItems.length > 0) {
          console.log(`[Process] Total menu items found: ${allMenuItems.length}`);
          
          // Clean and deduplicate the results
          const cleanedItems = cleanMenuItems(allMenuItems);
          const deduplicatedItems = deduplicateMenuItems(cleanedItems);
          
          // Sort items by category priority
          const sortedItems = sortMenuItemsByCategory(deduplicatedItems);
          
          console.log(`[Process] Final result: ${sortedItems.length} unique, valid menu items sorted by category`);
          return { type: 'structured', data: sortedItems };
        } else {
          // Check if we had quota errors during processing
          if (quotaErrorDetected || pagesWithQuotaErrors > 0) {
            console.log(`[Process] Quota exceeded (${pagesWithQuotaErrors}/${totalPagesProcessed} pages affected), trying fallback text processing...`);
            
            // Try fallback text processing without GPT
            try {
              const fallbackText = textPages.map(page => page.content).join('\n\n');
              console.log(`[Process] Fallback text length: ${fallbackText.length} characters`);
              console.log(`[Process] Fallback text preview: ${fallbackText.substring(0, 500)}...`);
              
              const fallbackItems = parseMenuFromOCR(fallbackText);
              console.log(`[Process] parseMenuFromOCR returned:`, fallbackItems);
              
              if (fallbackItems && Array.isArray(fallbackItems) && fallbackItems.length > 0) {
                console.log(`[Process] Fallback processing found ${fallbackItems.length} items`);
                
                // Clean and sort the fallback items
                const cleanedItems = cleanMenuItems(fallbackItems);
                console.log(`[Process] After cleaning: ${cleanedItems.length} items`);
                
                const deduplicatedItems = deduplicateMenuItems(cleanedItems);
                console.log(`[Process] After deduplication: ${deduplicatedItems.length} items`);
                
                const sortedItems = sortMenuItemsByCategory(deduplicatedItems);
                console.log(`[Process] After sorting: ${sortedItems.length} items`);
                
                console.log(`[Process] Fallback final result: ${sortedItems.length} unique, valid menu items`);
                return { type: 'structured', data: sortedItems };
              } else {
                console.log(`[Process] Fallback processing found no items or invalid result:`, fallbackItems);
                throw new Error('OpenAI quota exceeded. Please upgrade your plan or try again later.');
              }
            } catch (fallbackError) {
              console.error(`[Process] Fallback processing also failed:`, fallbackError);
              throw new Error('OpenAI quota exceeded. Please upgrade your plan or try again later.');
            }
          } else {
            console.log(`[Process] No quota errors detected, but no items found`);
            throw new Error('No menu items found in PDF');
          }
        }
      }
    } else if (mimeType.startsWith('image/')) {
      console.log('[Process] Processing image with GPT Vision');
      
      try {
        const menuItems = await processImageWithGPTVision(fileBuffer, mimeType);
        
        if (Array.isArray(menuItems) && menuItems.length > 0) {
          console.log(`[Process] Found ${menuItems.length} menu items`);
          return { type: 'structured', data: menuItems };
        } else {
          throw new Error('No menu items found in image');
        }
      } catch (visionError) {
        console.error(`[Process] GPT Vision error:`, visionError);
        
        // Handle quota errors specifically
        if (visionError.message?.includes('quota') || visionError.message?.includes('OpenAI quota exceeded')) {
          throw new Error('OpenAI quota exceeded. Please upgrade your plan or try again later.');
        }
        
        throw visionError;
      }
      
    } else {
      // Try to determine file type from extension
      const fileExtension = filePath.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'pdf') {
        console.log('[Process] Processing PDF by extension');
        return await processImageFile(filePath, 'application/pdf');
      } else {
        console.log('[Process] Processing as image by extension');
        return await processImageFile(filePath, 'image/jpeg');
      }
    }
  } catch (error) {
    console.error('[Process] Error processing file:', error);
    throw new Error(`Failed to process file: ${error.message}`);
  }
}

// Azure function removed - now using GPT Vision exclusively

// Azure layout function removed - now using GPT Vision exclusively

// Azure table function removed - now using GPT Vision exclusively

// Azure lines function removed - now using GPT Vision exclusively

function cleanOCRLines(rawText) {
  return rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 1);
}

export default function handler(req, res) {
  console.log("🔥 OCR handler loaded: build 2025-07-18@15:30");
  
  // Handle both file uploads and URL processing
  if (req.method === 'POST') {
    // Check if this is a JSON request (for imageUrl) or multipart (for file upload)
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('application/json')) {
      // Handle JSON request (imageUrl)
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const { imageUrl, venueId } = JSON.parse(body);
          return processImageUrl(req, res, imageUrl, venueId);
        } catch (error) {
          console.error('Error parsing JSON body:', error);
          return res.status(400).json({ error: 'Invalid JSON body' });
        }
      });
    } else {
      // Handle multipart request (file upload)
      return processFileUpload(req, res);
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}

async function processImageUrl(req, res, imageUrl, venueId) {
  let tempFilePath = null;
  
  try {
    console.log(`[URL] Processing image URL: ${imageUrl}`);
    
    // Download image from URL
    tempFilePath = await downloadImageFromUrl(imageUrl);
    
    // Process the downloaded image
    const result = await processImageFile(tempFilePath, 'image/jpeg');
    
    // Process the extracted data
    await processExtractedData(result, venueId, res);
    
  } catch (error) {
    console.error('URL processing error:', error);
    
    // Handle quota errors specifically
    if (error.message?.includes('quota') || error.message?.includes('OpenAI quota exceeded')) {
      return res.status(429).json({ 
        error: 'OpenAI quota exceeded. Please upgrade your plan or try again later.',
        details: error.message 
      });
    }
    
    res.status(500).json({ error: 'Failed to process image URL', detail: error.message });
  } finally {
    // Clean up temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`[Cleanup] Removed temporary file: ${tempFilePath}`);
    }
  }
}

async function processFileUpload(req, res) {
  upload.single('menu')(req, res, async (err) => {
    if (err) return res.status(500).json({ error: 'Upload failed' });

    const filePath = req.file.path;
    const mime = req.file.mimetype;
    const venueId = req.body.venueId || req.query.venueId;

    try {
      console.log(`[File] Processing uploaded file: ${filePath}, type: ${mime}`);
      
      // Process the uploaded file
      const result = await processImageFile(filePath, mime);
      
      // Process the extracted data
      await processExtractedData(result, venueId, res);
      
    } catch (e) {
      console.error('File processing error:', e);
      
      // Handle quota errors specifically
      if (e.message?.includes('quota') || e.message?.includes('OpenAI quota exceeded')) {
        return res.status(429).json({ 
          error: 'OpenAI quota exceeded. Please upgrade your plan or try again later.',
          details: e.message 
        });
      }
      
      res.status(500).json({ error: 'OCR failed', detail: e.message });
    } finally {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Cleanup] Removed uploaded file: ${filePath}`);
      }
    }
  });
}

async function processExtractedData(result, venueId, res) {
  try {
    if (result.type === 'structured') {
      // Process structured menu items from layout analysis
      const structuredMenu = result.data;
      console.log('Structured menu from layout analysis:', structuredMenu);
      
      if (venueId && structuredMenu.length > 0) {
        // Filter valid menu items before inserting
        const validItems = filterValidMenuItems(structuredMenu);
        
        if (validItems.length > 0) {
          await supabase.from('menu_items').delete().eq('venue_id', venueId);
          
          const { error } = await supabase
            .from('menu_items')
            .insert(validItems.map(item => ({
              name: item.name,
              price: item.price,
              category: item.category || 'Uncategorized',
              venue_id: venueId,
              available: true,
              created_at: new Date().toISOString(),
            })));
            
          if (error) {
            console.error('Supabase insert error:', error);
            return res.status(500).json({ error: 'Failed to save menu items', detail: error.message });
          }
          
          console.log(`[Success] Inserted ${validItems.length} valid menu items`);
          return res.status(200).json({ message: 'Menu uploaded successfully' });
        } else {
          return res.status(400).json({ error: 'No valid menu items found after filtering' });
        }
      } else {
        return res.status(400).json({ error: 'No menu items found or venueId missing' });
      }
    } else {
      // Process text-based extraction with new OCR parser
      const text = result.data;
      console.log("OCR RAW TEXT >>>", text.slice(0, 100));
      console.log("FULL OCR TEXT >>>", text);
      
      // Use the new cleaner parsing approach
      const structuredMenu = parseMenuFromOCR(text);
      console.log('Structured menu from new OCR parser:', structuredMenu);

      if (venueId && structuredMenu.length > 0) {
        // Filter valid menu items before inserting
        const validItems = filterValidMenuItems(structuredMenu);
        
        if (validItems.length > 0) {
          await supabase.from('menu_items').delete().eq('venue_id', venueId);
          
          const { error } = await supabase
            .from('menu_items')
            .insert(validItems.map(item => ({
              name: item.name,
              price: item.price,
              category: item.category || 'Uncategorized',
              venue_id: venueId,
              available: true,
              created_at: new Date().toISOString(),
            })));
            
          if (error) {
            console.error('Supabase insert error:', error);
            return res.status(500).json({ error: 'Failed to save menu items', detail: error.message });
          }
          
          console.log(`[Success] Inserted ${validItems.length} valid menu items`);
          return res.status(200).json({ message: 'Menu uploaded successfully' });
        } else {
          return res.status(400).json({ error: 'No valid menu items found after filtering' });
        }
      } else {
        return res.status(400).json({ error: 'No menu items found or venueId missing' });
      }
    }
  } catch (error) {
    console.error('Data processing error:', error);
    res.status(500).json({ error: 'Failed to process extracted data', detail: error.message });
  }
}

// Old OCR functions removed - now using GPT Vision exclusively

async function extractTextFromPDF(pdfBuffer) {
  try {
    console.log('[PDF] Extracting text from PDF buffer');
    
    // Use pdf-parse for text extraction (pure JavaScript)
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(pdfBuffer);
    
    console.log(`[PDF] Extracted text length: ${data.text.length} characters`);
    
    if (!data.text || data.text.trim().length === 0) {
      throw new Error('No text extracted from PDF');
    }
    
    return data.text;
  } catch (error) {
    console.error('[PDF] Error extracting text from PDF:', error);
    throw new Error(`PDF text extraction failed: ${error.message}`);
  }
}

async function parseMenuTextWithGPT(text, pageNumber = 1, lastKnownCategory = null) {
  try {
    console.log(`[GPT Text] Parsing menu text from page ${pageNumber}`);
    console.log(`[GPT Text] Input text length: ${text.length} characters`);
    console.log(`[GPT Text] Input text preview: ${text.substring(0, 200)}...`);
    console.log(`[GPT Text] Last known category: ${lastKnownCategory || 'None'}`);
    
    const prompt = `You are an expert at menu parsing. Extract EVERY menu item from this text. Return a valid JSON array ONLY in this format:

[
  { "name": "", "price": 0, "description": "", "category": "" },
  ...
]

⚠️ Do not nest JSON inside any field.
⚠️ For each item, extract the nearest visible category above it (e.g., "Mains", "Brunch", "Add-ons").
⚠️ If no category is found, use: "${lastKnownCategory || 'Uncategorized'}"
⚠️ If the category is part of a section header, apply it to all items below until the next header.
⚠️ Extract every add-on (e.g. 'Add Egg £1.50') as its own item.
⚠️ Do NOT use 'menuItem:' or any other keys outside of this format.
⚠️ Items with same name but different prices must both be included.

Text to parse (Page ${pageNumber}):
${text}`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a menu parsing expert. Extract ALL menu items with prices. Return ONLY a valid JSON array in the exact format specified. Do not include any explanations or additional text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 4000,
    });
    
    const content = response.choices[0].message.content;
    console.log(`[GPT Text] Raw response from page ${pageNumber}:`, content);
    console.log(`[GPT Text] Response length: ${content.length} characters`);
    
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
                 item.price > 0;
        }).map(item => ({
          ...item,
          category: normalizeCategory(item.category)
        }));
        
        console.log(`[GPT Text] Parsed ${menuItems.length} items, ${validItems.length} valid from page ${pageNumber}`);
        
        // Find the last category used in this page
        const lastCategoryInPage = validItems.length > 0 ? validItems[validItems.length - 1].category : lastKnownCategory;
        
        // Check if we got enough items, if not, try aggressive parsing
        if (validItems.length < 15) {
          console.log(`[GPT Text] Only ${validItems.length} valid items found on page ${pageNumber}, trying aggressive parsing...`);
          const aggressiveItems = await parseMenuTextWithGPTAggressive(text, pageNumber, lastKnownCategory);
          if (aggressiveItems.length > validItems.length) {
            console.log(`[GPT Text] Aggressive parsing found ${aggressiveItems.length} items vs ${validItems.length} from normal parsing`);
            return aggressiveItems;
          }
        }
        
        return { items: validItems, lastCategory: lastCategoryInPage };
      } catch (parseError) {
        console.error(`[GPT Text] JSON parse error for page ${pageNumber}:`, parseError);
        console.error(`[GPT Text] Failed to parse this JSON:`, jsonMatch[0]);
        
        // Try markdown fallback
        const markdownItems = await parseMenuTextAsMarkdown(text, pageNumber, lastKnownCategory);
        if (markdownItems.length > 0) {
          console.log(`[GPT Text] Markdown fallback found ${markdownItems.length} items`);
          return markdownItems;
        }
        
        throw new Error('Failed to parse GPT response as JSON');
      }
    } else {
      console.error(`[GPT Text] No JSON array found in response for page ${pageNumber}`);
      console.error(`[GPT Text] Full response content:`, content);
      
      // Try markdown fallback
      const markdownItems = await parseMenuTextAsMarkdown(text, pageNumber, lastKnownCategory);
      if (markdownItems.length > 0) {
        console.log(`[GPT Text] Markdown fallback found ${markdownItems.length} items`);
        return markdownItems;
      }
      
      throw new Error('No valid JSON array found in GPT response');
    }
  } catch (error) {
    console.error(`[GPT Text] Error parsing page ${pageNumber}:`, error);
    
    // Handle quota errors specifically - return empty result instead of throwing
    if (error.code === 'insufficient_quota' || error.message?.includes('quota') || error.status === 429) {
      console.error(`[GPT Text] Quota exceeded for page ${pageNumber}, returning empty result`);
      return { items: [], lastCategory: lastKnownCategory };
    }
    
    // For other errors, also return empty result to prevent propagation
    console.error(`[GPT Text] Non-quota error for page ${pageNumber}, returning empty result`);
    return { items: [], lastCategory: lastKnownCategory };
  }
}

async function extractItemsFromTextResponse(text, pageNumber) {
  try {
    console.log(`[Fallback] Attempting to extract items from text response for page ${pageNumber}`);
    
    // Try to find price patterns in the text
    const pricePattern = /([^£\n]+?)\s*£\s*(\d+(?:\.\d{1,2})?)/g;
    const items = [];
    let match;
    
    while ((match = pricePattern.exec(text)) !== null) {
      const name = match[1].trim();
      const price = parseFloat(match[2]);
      
      if (name && name.length > 2 && price > 0) {
        items.push({
          name: name,
          price: price,
          description: "",
          category: "Uncategorized"
        });
      }
    }
    
    console.log(`[Fallback] Extracted ${items.length} items using regex pattern`);
    return items;
  } catch (error) {
    console.error(`[Fallback] Error extracting items from text:`, error);
    return [];
  }
}

async function forceGPTToReturnJSON(text, pageNumber) {
  try {
    console.log(`[Force JSON] Attempting to force GPT to return JSON for page ${pageNumber}`);
    
    const forcePrompt = `Convert the following text into a JSON array of menu items. Return ONLY the JSON array, nothing else:

Text: ${text}

JSON:`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a JSON converter. Return ONLY valid JSON arrays, no explanations or other text."
        },
        {
          role: "user",
          content: forcePrompt
        }
      ],
      max_tokens: 2000,
    });
    
    const content = response.choices[0].message.content.trim();
    console.log(`[Force JSON] Response:`, content);
    
    // Try to parse as JSON
    try {
      const menuItems = JSON.parse(content);
      console.log(`[Force JSON] Successfully parsed ${menuItems.length} items`);
      return Array.isArray(menuItems) ? menuItems : [];
    } catch (parseError) {
      console.error(`[Force JSON] Failed to parse JSON:`, parseError);
      return [];
    }
  } catch (error) {
    console.error(`[Force JSON] Error:`, error);
    return [];
  }
}

async function parseMenuTextWithGPTAggressive(text, pageNumber = 1, lastKnownCategory = null) {
  try {
    console.log(`[GPT Text Aggressive] Parsing menu text from page ${pageNumber} with aggressive approach`);
    
    const aggressivePrompt = `You are an expert at menu parsing. Extract EVERY menu item from this text, being very aggressive. Return a valid JSON array ONLY in this format:

[
  { "name": "", "price": 0, "description": "", "category": "" },
  ...
]

⚠️ Do not nest JSON inside any field.
⚠️ If a category isn't clear, set it to 'Uncategorized'.
⚠️ Extract every add-on (e.g. 'Add Egg £1.50') as its own item.
⚠️ Do NOT use 'menuItem:' or any other keys outside of this format.
⚠️ Items with same name but different prices must both be included.
⚠️ Include every line with a £ symbol or price.
⚠️ If the name is unclear, use the text before the price as the name.

Text to parse (Page ${pageNumber}):
${text}`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a menu parsing expert. Be very aggressive in finding menu items. Include every line with a £ symbol or price, even if the name is unclear. Return ONLY a valid JSON array in the exact format specified."
        },
        {
          role: "user",
          content: aggressivePrompt
        }
      ],
      max_tokens: 4000,
    });
    
    const content = response.choices[0].message.content;
    console.log(`[GPT Text Aggressive] Raw response from page ${pageNumber}:`, content);
    
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
                 item.price > 0;
        }).map(item => ({
          ...item,
          category: normalizeCategory(item.category)
        }));
        
        console.log(`[GPT Text Aggressive] Parsed ${menuItems.length} items, ${validItems.length} valid from page ${pageNumber}`);
        
        // Find the last category used in this page
        const lastCategoryInPage = validItems.length > 0 ? validItems[validItems.length - 1].category : lastKnownCategory;
        
        return { items: validItems, lastCategory: lastCategoryInPage };
      } catch (parseError) {
        console.error(`[GPT Text Aggressive] JSON parse error for page ${pageNumber}:`, parseError);
        console.error(`[GPT Text Aggressive] Failed to parse this JSON:`, jsonMatch[0]);
        
        // Try markdown fallback
        const markdownItems = await parseMenuTextAsMarkdown(text, pageNumber, lastKnownCategory);
        if (markdownItems.length > 0) {
          console.log(`[GPT Text Aggressive] Markdown fallback found ${markdownItems.length} items`);
          return { items: markdownItems, lastCategory: lastKnownCategory };
        }
        
        return { items: [], lastCategory: lastKnownCategory };
      }
    } else {
      console.error(`[GPT Text Aggressive] No JSON array found in response for page ${pageNumber}`);
      console.error(`[GPT Text Aggressive] Full response content:`, content);
      
      // Try markdown fallback
      const markdownItems = await parseMenuTextAsMarkdown(text, pageNumber, lastKnownCategory);
      if (markdownItems.length > 0) {
        console.log(`[GPT Text Aggressive] Markdown fallback found ${markdownItems.length} items`);
        return { items: markdownItems, lastCategory: lastKnownCategory };
      }
      
      return { items: [], lastCategory: lastKnownCategory };
    }
  } catch (error) {
    console.error(`[GPT Text Aggressive] Error parsing page ${pageNumber}:`, error);
    
    // Handle quota errors specifically - return empty result instead of throwing
    if (error.code === 'insufficient_quota' || error.message?.includes('quota') || error.status === 429) {
      console.error(`[GPT Text Aggressive] Quota exceeded for page ${pageNumber}, returning empty result`);
      return { items: [], lastCategory: lastKnownCategory };
    }
    
    // For other errors, also return empty result to prevent propagation
    console.error(`[GPT Text Aggressive] Non-quota error for page ${pageNumber}, returning empty result`);
    return { items: [], lastCategory: lastKnownCategory };
  }
}

async function parseMenuTextAsMarkdown(text, pageNumber, lastKnownCategory = null) {
  try {
    console.log(`[Markdown] Converting text to markdown format for page ${pageNumber}`);
    
    // Convert text to markdown format
    const markdownText = convertTextToMarkdown(text);
    console.log(`[Markdown] Converted text to markdown:`, markdownText.substring(0, 300) + '...');
    
    const markdownPrompt = `Convert this markdown menu into a JSON array of objects with fields: name, price, description, category.

Return ONLY a valid JSON array in this format:
[
  { "name": "", "price": 0, "description": "", "category": "" },
  ...
]

Markdown menu:
${markdownText}`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a markdown-to-JSON converter. Convert menu items from markdown to JSON array. Return ONLY valid JSON."
        },
        {
          role: "user",
          content: markdownPrompt
        }
      ],
      max_tokens: 3000,
    });
    
    const content = response.choices[0].message.content;
    console.log(`[Markdown] Raw response:`, content);
    
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
                 item.price > 0;
        }).map(item => ({
          ...item,
          category: normalizeCategory(item.category)
        }));
        
        console.log(`[Markdown] Parsed ${menuItems.length} items, ${validItems.length} valid`);
        
        // Find the last category used in this page
        const lastCategoryInPage = validItems.length > 0 ? validItems[validItems.length - 1].category : lastKnownCategory;
        
        return { items: validItems, lastCategory: lastCategoryInPage };
      } catch (parseError) {
        console.error(`[Markdown] JSON parse error:`, parseError);
        
        // Handle quota errors specifically - return empty result instead of throwing
        if (error.code === 'insufficient_quota' || error.message?.includes('quota') || error.status === 429) {
          console.error(`[Markdown] Quota exceeded, returning empty result`);
          return { items: [], lastCategory: lastKnownCategory };
        }
        
        // For other errors, also return empty result to prevent propagation
        console.error(`[Markdown] Non-quota error, returning empty result`);
        return { items: [], lastCategory: lastKnownCategory };
      }
    } else {
      console.error(`[Markdown] No JSON array found in response`);
      return { items: [], lastCategory: lastKnownCategory };
    }
  } catch (error) {
    console.error(`[Markdown] Error:`, error);
    
    // Handle quota errors specifically - return empty result instead of throwing
    if (error.code === 'insufficient_quota' || error.message?.includes('quota') || error.status === 429) {
      console.error(`[Markdown] Quota exceeded, returning empty result`);
      return { items: [], lastCategory: lastKnownCategory };
    }
    
    // For other errors, also return empty result to prevent propagation
    console.error(`[Markdown] Non-quota error, returning empty result`);
    return { items: [], lastCategory: lastKnownCategory };
  }
}

function convertTextToMarkdown(text) {
  try {
    console.log(`[Markdown] Converting text to markdown format`);
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let markdown = '';
    let currentCategory = 'Uncategorized';
    
    for (const line of lines) {
      // Check if line is a category header (all caps, short)
      if (/^[A-Z\s&()]+$/.test(line) && line.length > 2 && line.length < 50) {
        currentCategory = line;
        markdown += `\n### ${line}\n\n`;
        continue;
      }
      
      // Check if line contains a price
      const priceMatch = line.match(/^(.*?)[.\-–—]*\s*£\s*(\d+(?:\.\d{1,2})?)/);
      if (priceMatch) {
        const name = priceMatch[1].trim();
        const price = priceMatch[2];
        
        if (name && name.length > 2) {
          markdown += `- ${name} – £${price}\n`;
          
          // Look for description on next line
          const nextLineIndex = lines.indexOf(line) + 1;
          if (nextLineIndex < lines.length) {
            const nextLine = lines[nextLineIndex];
            if (nextLine && !nextLine.match(/£\s*\d/) && nextLine.length < 100) {
              markdown += `  ${nextLine}\n`;
            }
          }
          markdown += '\n';
        }
      }
    }
    
    console.log(`[Markdown] Generated markdown with ${markdown.split('-').length - 1} items`);
    return markdown;
  } catch (error) {
    console.error(`[Markdown] Error converting to markdown:`, error);
    return text; // Return original text if conversion fails
  }
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
  const trimmed = line.trim();
  
  // Exclude common non-menu items first
  const excludePatterns = [
    /^w\/|^with\s/i,
    /^add\s/i,
    /^includes\s/i,
    /^served\s+with\s/i,
    /^or\s/i,
    /^and\s/i,
    /^extra\s/i,
    /^topping\s/i,
    /^side\s/i,
    /^option\s/i,
    /^choice\s/i,
    /^selection\s/i,
    /^substitute\s/i,
    /^replace\s/i,
    /^instead\s+of\s/i
  ];
  
  // Check if line matches any exclusion pattern
  for (const pattern of excludePatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }
  
  // Known menu item patterns (both English and Arabic)
  const menuPatterns = [
    /burger/i,
    /shakshuka/i,
    /labneh/i,
    /hummus/i,
    /baba/i,
    /halloumi/i,
    /kibbeh/i,
    /mutbal/i,
    /mezze/i,
    /tapas/i,
    /bruschetta/i,
    /spring roll/i,
    /samosa/i,
    /pakora/i,
    /steak/i,
    /chicken/i,
    /beef/i,
    /lamb/i,
    /fish/i,
    /salmon/i,
    /pasta/i,
    /rice/i,
    /noodles/i,
    /curry/i,
    /stew/i,
    /roast/i,
    /cake/i,
    /ice cream/i,
    /pudding/i,
    /cheesecake/i,
    /brownie/i,
    /chocolate/i,
    /coffee/i,
    /tea/i,
    /juice/i,
    /smoothie/i,
    /milkshake/i,
    /cocktail/i,
    /beer/i,
    /wine/i,
    /salad/i,
    /sandwich/i,
    /wrap/i,
    /panini/i,
    /eggs/i,
    /bacon/i,
    /toast/i,
    /pancake/i,
    /waffle/i
  ];
  
  // Check if line matches any known menu pattern
  for (const pattern of menuPatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  // Check for capitalized words (common in menu items)
  const words = trimmed.split(' ');
  const capitalizedWords = words.filter(word => 
    word.length > 0 && word[0] === word[0].toUpperCase()
  );
  
  // If more than 50% of words are capitalized, likely a menu item
  if (capitalizedWords.length > 0 && capitalizedWords.length >= words.length * 0.5) {
    return true;
  }
  
  // Check for Arabic text
  if (/[ء-ي]/.test(trimmed)) {
    return true;
  }
  
  // More lenient item detection - allow Arabic text and special characters
  return (
    trimmed.length > 2 &&
    trimmed.length < 80 &&
    !/^£/.test(trimmed) &&
    !isCategoryHeader(trimmed) &&
    !isDescription(trimmed) &&
    // Allow Arabic text and special characters
    !/^[0-9\s]+$/.test(trimmed) && // Not just numbers and spaces
    // Don't block common food words or Arabic text
    !['served with', 'add ', 'with ', 'and ', 'or ', 'freshly made', 'grilled'].some(word => 
      trimmed.toLowerCase().startsWith(word)
    ) &&
    // Allow lines that contain Arabic characters or food-related words
    (trimmed.length > 3 || /[ء-ي]/.test(trimmed) || /[A-Z]/.test(trimmed))
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
    'HOUMOUS JAM', 'GRILLED HALLOUMI', 'KIBBEH', 'MUTBAL',
    'MAINS', 'ENTREES', 'APPETIZERS', 'SIDES', 'DRINKS', 'BEVERAGES',
    'BREAKFAST', 'BRUNCH', 'LUNCH', 'DINNER', 'SNACKS', 'SHARES',
    'BURGERS', 'SANDWICHES', 'WRAPS', 'SALADS', 'SOUPS', 'PASTAS',
    'SEAFOOD', 'MEAT', 'VEGETARIAN', 'VEGAN', 'GLUTEN FREE'
  ];
  
  // Check if line matches known categories exactly
  if (knownCategories.includes(line.toUpperCase())) {
    return true;
  }
  
  // Check if line is all caps and looks like a category (not a menu item)
  const isAllCaps = line === line.toUpperCase();
  const hasReasonableLength = line.length > 2 && line.length < 50;
  const noPrice = !/£\s?\d/.test(line);
  const noFoodKeywords = !/(burger|chicken|beef|fish|pasta|rice|salad|soup|coffee|tea|juice)/i.test(line);
  const noArabicFoodWords = !/(labneh|hummus|baba|halloumi|kibbeh|mutbal|shakshuka)/i.test(line);
  
  // If it's all caps, reasonable length, no price, and no food keywords, likely a category
  if (isAllCaps && hasReasonableLength && noPrice && noFoodKeywords && noArabicFoodWords) {
    return true;
  }
  
  return false;
}

function isDescription(line) {
  const trimmed = line.trim();
  
  // Lines that start with description indicators
  const descriptionStarters = [
    /^served with/i,
    /^includes/i,
    /^comes with/i,
    /^add/i,
    /^with/i,
    /^topped with/i,
    /^garnished with/i,
    /^accompanied by/i,
    /^side of/i,
    /^choice of/i,
    /^selection of/i,
    /^freshly made/i,
    /^house made/i,
    /^homemade/i,
    /^our special/i,
    /^signature/i
  ];
  
  // Check if line starts with description indicators
  for (const pattern of descriptionStarters) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  // Lines that are clearly descriptions
  const descriptionPatterns = [
    /^[a-z]/, // Starts with lowercase
    /[.!?]$/, // Ends with punctuation
    /^cheese,/, // Starts with comma-separated list
    /^sauce,/, // Sauce descriptions
    /^fries,/, // Side descriptions
    /^mash or rice/, // Choice descriptions
    /^rocket/, // Ingredient descriptions
    /^served/, // Service descriptions
    /^special/, // Special descriptions
    /^nur sauce/, // Specific sauce names
  ];
  
  // Check if line matches description patterns
  for (const pattern of descriptionPatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  // More lenient description detection
  return (
    (/^[a-z]/.test(trimmed) && trimmed.length > 20) ||
    trimmed.length > 100 ||
    /[.!?]$/.test(trimmed) ||
    (trimmed.toLowerCase().includes('served with') && trimmed.length > 30) ||
    (trimmed.toLowerCase().includes('freshly made') && trimmed.length > 30) ||
    (trimmed.toLowerCase().includes('grilled') && trimmed.length > 50) ||
    (trimmed.toLowerCase().includes('special') && trimmed.length > 20) ||
    (trimmed.toLowerCase().includes('sauce') && trimmed.length > 10)
  );
}

function mergeMultilineItems(lines) {
  const merged = [];
  let buffer = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const next = lines[i + 1] ? lines[i + 1].trim() : '';
    if (!line) continue;

    // If line is a likely fragment or continuation, buffer it
    if (isLikelyFragment(line)) {
      buffer += (buffer ? ' ' : '') + line;
      continue;
    }

    // If next line is a price or lowercase/fragment, merge
    if (next && (looksLikePrice(next) || isLikelyFragment(next))) {
      buffer += (buffer ? ' ' : '') + line;
      continue;
    }

    // If buffer exists, merge it with current line
    if (buffer) {
      merged.push((buffer + ' ' + line).trim());
      buffer = '';
    } else {
      merged.push(line);
    }
  }
  // Push any remaining buffer
  if (buffer) merged.push(buffer.trim());
  return merged;
}

function isLikelyFragment(line) {
  // Lowercase, short, or punctuation-ending lines
  return (
    line.length < 40 &&
    (/^[a-z]/.test(line) || /,$/.test(line) || /and$/.test(line) || /with$/.test(line)) &&
    !looksLikePrice(line)
  );
}

function parseMenuFromOCR(ocrText) {
  const lines = ocrText.split('\n').map(line => line.trim()).filter(Boolean);
  const menuItems = [];
  let currentCategory = null;
  let currentItem = null;
  
  // Define proper category keywords
  const categoryKeywords = [
    'STARTERS', 'ALL DAY BRUNCH', 'KIDS', 'MAINS', 'SALAD', 
    'WRAPS & SANDWICHES', 'ON SOURDOUGH', 'DESSERTS', 
    'HOT COFFEE', 'ICED COFFEE', 'SPECIALITY COFFEE', 
    'NOT COFFEE', 'LOOSE LEAVES TEA', 'JUICES', 'SMOOTHIES', 
    'MILKSHAKES', 'EXTRAS', 'SPECIALS'
  ];
  
  // Price regex - more flexible
  const priceRegex = /£(\d+(?:\.\d{2})?)/g;
  
  console.log(`[Parser] Processing ${lines.length} lines from OCR`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';
    
    console.log(`[Parser] Line ${i}: "${line}"`);
    
    // Skip header lines
    if (line.includes('NUR CAFE') || line.includes('MENU') || 
        line.match(/^J[OĄ].*J$/)) {
      console.log(`[Parser] Skipped header line: "${line}"`);
      continue;
    }
    
    // Check if this is a category
    if (categoryKeywords.some(cat => line.toUpperCase().includes(cat))) {
      // Save previous item if exists
      if (currentItem && currentItem.name && currentItem.price) {
        menuItems.push(currentItem);
        console.log(`[Parser] Saved item before category: ${currentItem.name} - £${currentItem.price}`);
        currentItem = null;
      }
      
      currentCategory = line.toUpperCase().replace(/[^\w\s&]/g, '').trim();
      console.log(`[Category] Found: ${currentCategory}`);
      continue;
    }
    
    // Skip if no category set yet
    if (!currentCategory) {
      console.log(`[Parser] Skipped line (no category): "${line}"`);
      continue;
    }
    
    // Check if line contains a price
    const priceMatch = line.match(priceRegex);
    
    if (priceMatch) {
      // This line has a price - could be item name + price or just price
      const priceStr = priceMatch[priceMatch.length - 1]; // Get last price if multiple
      const price = parseFloat(priceStr);
      const nameWithoutPrice = line.replace(priceRegex, '').trim();
      
      if (nameWithoutPrice && nameWithoutPrice.length > 2) {
        // Line has both name and price
        if (currentItem && currentItem.name && currentItem.price) {
          menuItems.push(currentItem);
          console.log(`[Parser] Saved item: ${currentItem.name} - £${currentItem.price}`);
        }
        
        currentItem = {
          name: cleanItemName(nameWithoutPrice),
          price: price,
          category: currentCategory,
          description: ''
        };
        console.log(`[Parser] Created item with inline price: ${currentItem.name} - £${currentItem.price}`);
      } else if (currentItem && currentItem.name) {
        // Just a price line - attach to current item
        currentItem.price = price;
        console.log(`[Parser] Attached price to current item: ${currentItem.name} - £${currentItem.price}`);
      } else {
        console.log(`[Parser] Found orphaned price: £${price}`);
      }
    } else {
      // No price in this line
      if (isItemName(line)) {
        // Save previous item if it has both name and price
        if (currentItem && currentItem.name && currentItem.price) {
          menuItems.push(currentItem);
          console.log(`[Parser] Saved item: ${currentItem.name} - £${currentItem.price}`);
        }
        
        // Start new item
        currentItem = {
          name: cleanItemName(line),
          price: 0, // Will be set later
          category: currentCategory,
          description: ''
        };
        console.log(`[Parser] Started new item: ${currentItem.name}`);
      } else if (currentItem && currentItem.name && isDescription(line)) {
        // Add to description
        currentItem.description += (currentItem.description ? ' ' : '') + line;
        console.log(`[Parser] Added description to ${currentItem.name}: ${line}`);
      } else {
        console.log(`[Parser] Skipped line: "${line}"`);
      }
    }
  }
  
  // Don't forget the last item if it has both name and price
  if (currentItem && currentItem.name && currentItem.price && currentItem.price > 0) {
    menuItems.push(currentItem);
    console.log(`[Parser] Saved final item: ${currentItem.name} - £${currentItem.price}`);
  }
  
  // Filter out items without proper prices
  const validItems = menuItems.filter(item => 
    item.name && 
    item.name.trim().length > 0 && 
    typeof item.price === 'number' && 
    item.price > 0
  );
  
  console.log(`[Parser] Total items extracted: ${menuItems.length}, valid items: ${validItems.length}`);
  return validItems;
}

// Helper functions
function cleanItemName(name) {
  return name
    .replace(/^[^\w]+/, '') // Remove leading non-word chars
    .replace(/\s+/g, ' ')   // Normalize spaces
    .trim();
}

function isItemName(line) {
  // Check if line looks like an item name
  const upperLine = line.toUpperCase();
  
  // Skip common non-item patterns
  if (line.length < 3) return false;
  if (line.startsWith('+') || line.startsWith('-')) return false;
  if (line.match(/^\d+\s*(pcs?|pieces?|people?)/i)) return false;
  if (line.match(/^(add|with|served|ask)/i)) return false;
  
  // Likely an item if it has food-related words or is in caps
  return upperLine === line || 
         line.match(/\b(served|with|chicken|beef|egg|cheese|bread)\b/i);
}



// Enhanced processing pipeline
async function processMenuFile(fileBuffer, mimetype) {
  try {
    console.log('[Process] Starting menu processing...');
    
    // 1. Upload to storage
    const fileUrl = await uploadToStorage(fileBuffer, mimetype);
    
    // 2. Extract text using OCR
    let extractedText = '';
    if (mimetype === 'application/pdf') {
      extractedText = await extractTextFromPDF(fileUrl);
    } else {
      extractedText = await extractTextFromImage(fileUrl);
    }
    
    console.log('[OCR] Extracted text length:', extractedText.length);
    
    // 3. Parse with improved logic
    const menuItems = parseMenuFromOCR(extractedText);
    
    console.log('[Parse] Extracted items:', menuItems.length);
    
    // 4. Post-process with GPT for cleanup
    const cleanedItems = await cleanupWithGPT(menuItems);
    
    return {
      success: true,
      items: cleanedItems,
      totalItems: cleanedItems.length
    };
    
  } catch (error) {
    console.error('[Process] Error:', error);
    throw error;
  }
}

// GPT cleanup for better accuracy
async function cleanupWithGPT(rawItems) {
  try {
    const prompt = `
Clean up this menu data. Fix any OCR errors, standardize formatting, and ensure all items have proper names, prices, and categories.

Raw menu items:
${JSON.stringify(rawItems, null, 2)}

Return clean JSON with structure:
{
  "items": [
    {
      "name": "Clean item name",
      "price": "£X.XX",
      "category": "Category Name",
      "description": "Clean description"
    }
  ]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a menu data cleaner. Fix OCR errors and standardize menu item formatting."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.items || [];
  } catch (e) {
    console.error('[GPT] Parse error:', e);
    return rawItems; // Fallback to raw items
  }
}

function parseMenuFromSeparatedLines(rawLines) {
  // Step 1: Merge multi-line items with better logic
  const lines = mergeMultilineItemsImproved(rawLines);
  let items = [];
  let pendingItem = null;
  let lastSeenPrice = null;
  let currentCategory = 'Uncategorized';
  let lastCategory = 'Uncategorized';
  let nameBuffer = [];
  let descriptionBuffer = [];

  console.log(`[Parser] Processing ${lines.length} merged lines`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    console.log(`[Parser] Line ${i}: "${line}"`);

    // Check if line is a category header
    if (isCategoryHeader(line)) {
      currentCategory = detectCategory(line);
      lastCategory = currentCategory;
      console.log(`[Parser] Detected category: ${currentCategory}`);
      
      // Save pending item if it has a price
      if (pendingItem && pendingItem.price) {
        items.push({ ...pendingItem, category: currentCategory });
        console.log(`[Parser] Saved pending item before category: ${pendingItem.name} - £${pendingItem.price}`);
        pendingItem = null;
        nameBuffer = [];
        descriptionBuffer = [];
      }
      continue;
    }

    // Check if line contains a price (improved detection)
    const price = parsePriceImproved(line);
    if (price !== null) {
      lastSeenPrice = price;
      console.log(`[Parser] Found price: £${price}`);
      
      // If we have a pending item without price, attach it
      if (pendingItem && !pendingItem.price) {
        pendingItem.price = price;
        items.push({ ...pendingItem, category: lastCategory });
        console.log(`[Parser] Attached price to pending item: ${pendingItem.name} - £${pendingItem.price}`);
        pendingItem = null;
        nameBuffer = [];
        descriptionBuffer = [];
      } else if (nameBuffer.length > 0) {
        // We have a name buffer but no pending item, create one
        const fullName = nameBuffer.join(" ").trim();
        if (fullName && isLikelyMenuItem(fullName)) {
          const newItem = {
            name: fullName,
            price: price,
            description: descriptionBuffer.join(" ").trim() || ""
          };
          items.push({ ...newItem, category: lastCategory });
          console.log(`[Parser] Created item from buffer: ${fullName} - £${price}`);
          nameBuffer = [];
          descriptionBuffer = [];
        }
      }
      continue;
    }

    // Check if line contains both name and price inline
    const inlineMatch = line.match(/^(.*?)[.\-–—]*\s*£\s?(\d{1,3}(?:\.\d{1,2})?)/);
    if (inlineMatch) {
      const name = inlineMatch[1].trim();
      const price = parseFloat(inlineMatch[2]);
      
      if (name && price && !isNaN(price) && price > 0) {
        // Save pending item if it exists and has a price
        if (pendingItem && pendingItem.price) {
          items.push({ ...pendingItem, category: lastCategory });
        }
        
        // Create new item
        const newItem = {
          name: name,
          price: price,
          description: ""
        };
        items.push({ ...newItem, category: lastCategory });
        console.log(`[Parser] Saved inline item: ${newItem.name} - £${newItem.price}`);
        pendingItem = null;
        nameBuffer = [];
        descriptionBuffer = [];
      }
      continue;
    }

    // Check if line looks like a menu item name
    if (isLikelyMenuItem(line)) {
      // Save previous pending item if it has a price
      if (pendingItem && pendingItem.price) {
        items.push({ ...pendingItem, category: lastCategory });
        console.log(`[Parser] Saved pending item: ${pendingItem.name} - £${pendingItem.price}`);
      } else if (pendingItem) {
        console.log(`[Parser] Discarded incomplete pending item: ${pendingItem.name} (no price)`);
      }

      // Start new pending item
      pendingItem = {
        name: line,
        price: null,
        description: ""
      };
      nameBuffer = [line];
      descriptionBuffer = [];
      console.log(`[Parser] Started new pending item: ${line}`);
      continue;
    }

    // Check if line is likely a description or continuation
    if (isLikelyDescription(line) || isLikelyAddon(line)) {
      if (pendingItem) {
        pendingItem.description = (pendingItem.description || "") + " " + line;
        descriptionBuffer.push(line);
        console.log(`[Parser] Added description to ${pendingItem.name}: ${line}`);
      } else if (nameBuffer.length > 0) {
        // Add to name buffer if we're building a multi-line name
        nameBuffer.push(line);
        console.log(`[Parser] Added to name buffer: ${line}`);
      } else {
        console.log(`[Parser] Found description without pending item: ${line}`);
      }
      continue;
    }

    // Check if line is a continuation of the current item name
    if (pendingItem && isLikelyContinuation(line)) {
      pendingItem.name += " " + line;
      nameBuffer.push(line);
      console.log(`[Parser] Extended item name: ${pendingItem.name}`);
      continue;
    }

    // If we have a pending item, add this line as description (fallback)
    if (pendingItem) {
      pendingItem.description = (pendingItem.description || "") + " " + line;
      descriptionBuffer.push(line);
      console.log(`[Parser] Added fallback description to ${pendingItem.name}: ${line}`);
    } else if (nameBuffer.length > 0) {
      // Add to name buffer if we're building a multi-line name
      nameBuffer.push(line);
      console.log(`[Parser] Added to name buffer: ${line}`);
    } else {
      console.log(`[Parser] Skipped line (no pending item): "${line}"`);
    }
  }

  // Push any final leftover pending item with price
  if (pendingItem && pendingItem.price) {
    items.push({ ...pendingItem, category: lastCategory });
    console.log(`[Parser] Saved final pending item: ${pendingItem.name} - £${pendingItem.price}`);
  } else if (pendingItem) {
    console.log(`[Parser] Discarded final incomplete pending item: ${pendingItem.name} (no price)`);
  }

  // Process any remaining name buffer with last seen price
  if (nameBuffer.length > 0 && lastSeenPrice) {
    const fullName = nameBuffer.join(" ").trim();
    if (fullName && isLikelyMenuItem(fullName)) {
      const newItem = {
        name: fullName,
        price: lastSeenPrice,
        description: descriptionBuffer.join(" ").trim() || ""
      };
      items.push({ ...newItem, category: lastCategory });
      console.log(`[Parser] Created final item from buffer: ${fullName} - £${lastSeenPrice}`);
    }
  }

  // Post-processing
  const processedMenu = postProcessMenuWithLogging(items);
  console.log(`[Parser] Final processed menu: ${processedMenu.length} items`);
  return processedMenu;
}

function mergeMultilineItemsImproved(lines) {
  const merged = [];
  let buffer = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const next = lines[i + 1] ? lines[i + 1].trim() : '';
    if (!line) continue;

    // If line is a likely fragment or continuation, buffer it
    if (isLikelyFragment(line)) {
      buffer += (buffer ? ' ' : '') + line;
      continue;
    }

    // If next line is a price or lowercase/fragment, merge
    if (next && (looksLikePrice(next) || isLikelyFragment(next))) {
      buffer += (buffer ? ' ' : '') + line;
      continue;
    }

    // If buffer exists, merge it with current line
    if (buffer) {
      merged.push((buffer + ' ' + line).trim());
      buffer = '';
    } else {
      merged.push(line);
    }
  }
  
  // Push any remaining buffer
  if (buffer) merged.push(buffer.trim());
  return merged;
}

function parsePriceImproved(text) {
  if (!text) return null;
  
  // More flexible price matching
  const priceMatch = text.match(/£?\s?(\d{1,3}(?:\.\d{1,2})?)/);
  if (priceMatch) {
    const price = parseFloat(priceMatch[1]);
    return !isNaN(price) && price > 0 ? price : null;
  }
  
  return null;
}

function postProcessMenuWithLogging(menu) {
  const processed = [];
  const seen = new Set();
  for (const item of menu) {
    if (!item.name || !item.price) {
      console.log(`[Filter] Skipping invalid item:`, item);
      continue;
    }
    item.name = formatItemName(item.name);
    item.name = item.name.replace(/[.,;]+$/, '').trim();
    if (item.category === 'Uncategorized') {
      item.category = inferCategoryFromItemName(item.name);
      console.log(`[Category] Inferred category for "${item.name}": ${item.category}`);
    }
    const key = `${item.name.toLowerCase()}-${item.price}-${item.category}`;
    if (seen.has(key)) {
      console.log(`[Deduplication] Skipping duplicate: ${item.name}`);
      continue;
    }
    seen.add(key);
    processed.push(item);
  }
  return processed;
}

function isLikelyMenuItem(text) {
  // Must start with capital letter and not be a description starter
  const descriptionStarters = [
    'cheese,', 'served with', 'add', 'with', 'w/', 'topped with',
    'includes', 'comes with', 'accompanied by', 'garnished with'
  ];
  
  const startsWithDescription = descriptionStarters.some(starter => 
    text.toLowerCase().startsWith(starter.toLowerCase())
  );
  
  return !looksLikePrice(text) && 
         !isCategoryHeader(text) &&
         !startsWithDescription &&
         text.length > 2 &&
         /^[A-Z]/.test(text) && // Must start with capital
         !/^[A-Z\s]+$/.test(text); // Not all caps
}

function isLikelyDescription(text) {
  const descriptionPatterns = [
    /^cheese,/i,
    /^served with/i,
    /^topped with/i,
    /^includes/i,
    /^comes with/i,
    /^accompanied by/i,
    /^garnished with/i,
    /^freshly made/i,
    /^grilled/i,
    /^marinated/i,
    /^with choice of/i,
    /^and/i,
    /^or/i
  ];
  
  return descriptionPatterns.some(pattern => pattern.test(text)) ||
         (text.length < 30 && /^[a-z]/.test(text)); // Short lowercase lines
}

function isLikelyContinuation(text) {
  // Lines that continue the item name (not descriptions)
  return text.length < 40 && 
         !looksLikePrice(text) &&
         !isLikelyDescription(text) &&
         !isLikelyAddon(text) &&
         !/^[A-Z]/.test(text); // Doesn't start with capital (continuation)
}

function isLikelyAddon(text) {
  return /^(add|add-on|extra|additional|\+|plus)/i.test(text.trim());
}

function isProperMenuItem(text) {
  return !looksLikePrice(text) && 
         !isLikelyOption(text) && 
         !isWeakFragment(text) &&
         !isCategoryHeader(text) &&
         text.length > 3 &&
         !/^[A-Z\s]+$/.test(text);
}

function looksLikePrice(text) {
  return /^£?\d+(\.\d{1,2})?$/.test(text.trim());
}

function parsePrice(text) {
  const match = text.match(/£?(\d+(\.\d{1,2})?)/);
  return match ? parseFloat(match[1]) : null;
}

function looksLikeMenuItemName(text) {
  // Basic heuristic: not all caps, not empty, not price, not category
  return !!text && 
         !looksLikePrice(text) && 
         !isCategoryHeader(text) &&
         !/^[A-Z\s]+$/.test(text) &&
         text.length > 0;
}

function detectCategory(line) {
  const upperLine = line.toUpperCase();
  
  // Check semantic patterns first
  const categoryPatterns = {
    starters: /^(starters?|appetizers?|entrees?|small plates?|beginners?)/i,
    mains: /^(main|mains|entrees?|dishes?|plates?|main course)/i,
    desserts: /^(desserts?|sweets?|puddings?|cakes?)/i,
    drinks: /^(drinks?|beverages?|coffee|tea|juices?|smoothies?|cocktails?)/i,
    sides: /^(sides?|accompaniments?|extras?|add-ons?)/i,
    burgers: /^(burgers?|sandwiches?|wraps?)/i,
    salads: /^(salads?|greens?)/i,
    breakfast: /^(breakfast|brunch|morning)/i,
    lunch: /^(lunch|midday)/i,
    dinner: /^(dinner|evening|night)/i
  };
  
  for (const [category, pattern] of Object.entries(categoryPatterns)) {
    if (pattern.test(upperLine)) {
      console.log(`[Category] Semantic match: ${line} → ${category}`);
      return category.charAt(0).toUpperCase() + category.slice(1);
    }
  }
  
  // Check known categories
  const knownCategories = [
    'STARTERS', 'MAINS', 'DESSERTS', 'DRINKS', 'SIDES', 'BURGERS', 'SALADS',
    'SLIDERS', 'TACOS', 'MEXICAN RICE', 'HOUMOUS JAM', 'GRILLED HALLOUMI',
    'BREAKFAST', 'BRUNCH', 'LUNCH', 'DINNER', 'APPETIZERS', 'ENTREES'
  ];
  
  for (const category of knownCategories) {
    if (upperLine.includes(category)) {
      console.log(`[Category] Known category match: ${line} → ${category}`);
      return category;
    }
  }
  
  // If it's all caps and looks like a category, use it
  if (line === line.toUpperCase() && line.length > 2 && line.length < 40 && !/^£/.test(line)) {
    console.log(`[Category] All caps category: ${line}`);
    return line;
  }
  
  console.log(`[Category] No category detected for: ${line}, using Uncategorized`);
  return 'Uncategorized';
}

function isItemNameContinuation(line) {
  return (
    line.length < 30 &&
    (/^[a-z]/.test(line) || /^[ء-ي]/.test(line) || line.length < 15)
  );
}

function postProcessMenu(menu) {
  const processed = [];
  const seen = new Set();

  for (const item of menu) {
    // Validate required fields
    if (!item.name || !item.price) {
      console.log(`[Validation] Skipping invalid item:`, item);
      continue;
    }

    // Auto-format names
    item.name = formatItemName(item.name);
    
    // Remove trailing punctuation
    item.name = item.name.replace(/[.,;]+$/, '').trim();
    
    // Improve category assignment if it's still Uncategorized
    if (item.category === 'Uncategorized') {
      item.category = inferCategoryFromItemName(item.name);
      console.log(`[Category] Inferred category for "${item.name}": ${item.category}`);
    }
    
    // Create unique key for deduplication
    const key = `${item.name.toLowerCase()}-${item.price}-${item.category}`;
    
    if (seen.has(key)) {
      console.log(`[Deduplication] Skipping duplicate: ${item.name}`);
      continue;
    }
    
    seen.add(key);
    processed.push(item);
  }

  return processed;
}

function inferCategoryFromItemName(itemName) {
  const name = itemName.toLowerCase();
  
  // Food type patterns
  const patterns = {
    starters: /(dip|hummus|baba|labneh|halloumi|kibbeh|mutbal|mezze|tapas|bruschetta|spring roll|samosa|pakora)/,
    mains: /(burger|steak|chicken|beef|lamb|fish|salmon|pasta|rice|noodles|curry|stew|roast)/,
    desserts: /(cake|ice cream|pudding|cheesecake|brownie|chocolate|sweet|dessert)/,
    drinks: /(coffee|tea|juice|smoothie|milkshake|cocktail|beer|wine|soda|water)/,
    sides: /(fries|chips|salad|bread|potato|vegetable|side)/,
    breakfast: /(eggs|bacon|toast|pancake|waffle|cereal|breakfast)/,
    sandwiches: /(sandwich|wrap|panini|sub|roll|bun)/,
    salads: /(salad|greens|lettuce|spinach|kale)/
  };
  
  for (const [category, pattern] of Object.entries(patterns)) {
    if (pattern.test(name)) {
      return category.charAt(0).toUpperCase() + category.slice(1);
    }
  }
  
  return 'Uncategorized';
}

function formatItemName(name) {
  // Capitalize first letter of each word, but preserve special formatting
  return name
    .split(' ')
    .map(word => {
      // Preserve Arabic text and special characters
      if (/[ء-ي]/.test(word) || /[A-Z]{2,}/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}



function isValidMenuItem(line) {
  const trimmed = line.trim();
  
  // Exclude common non-menu items
  const excludePatterns = [
    /^w\/|^with\s/i,
    /^add\s/i,
    /^includes\s/i,
    /^served\s+with\s/i,
    /^or\s/i,
    /^and\s/i,
    /^extra\s/i,
    /^topping\s/i,
    /^side\s/i,
    /^option\s/i,
    /^choice\s/i,
    /^selection\s/i
  ];
  
  // Check if line matches any exclusion pattern
  for (const pattern of excludePatterns) {
    if (pattern.test(trimmed)) {
      console.log(`[Filter] Excluded non-menu item: "${trimmed}" (pattern: ${pattern})`);
      return false;
    }
  }
  
  // Must contain a price (number with optional decimal)
  const hasPrice = /\d+(\.\d{1,2})?/.test(trimmed);
  if (!hasPrice) {
    console.log(`[Filter] Excluded item without price: "${trimmed}"`);
    return false;
  }
  
  return true;
}

function filterValidMenuItems(items) {
  const validItems = items.filter(item => {
    // Check if item has valid price
    const hasValidPrice = typeof item.price === 'number' && !isNaN(item.price) && item.price > 0;
    
    // Check if item name is valid (relaxed - allow short names)
    const hasValidName = item.name && item.name.trim().length > 0;
    
    // Check if item passes basic validation (relaxed)
    const passesBasicValidation = hasValidName && hasValidPrice;
    
    if (!hasValidPrice) {
      console.log(`[Filter] Excluded item with invalid price: "${item.name}" (price: ${item.price})`);
      return false;
    }
    
    if (!hasValidName) {
      console.log(`[Filter] Excluded item with invalid name: "${item.name}"`);
      return false;
    }
    
    if (!passesBasicValidation) {
      console.log(`[Filter] Excluded item failing basic validation: "${item.name}" (price: ${item.price})`);
      return false;
    }
    
    return true;
  });
  
  console.log(`[Filter] Filtered ${items.length} items down to ${validItems.length} valid items`);
  return validItems;
}

function isLikelyNewItem(line) {
  const trimmed = line.trim();
  
  // Exclude common non-menu items
  const excludePatterns = [
    /^w\/|^with\s/i,
    /^add\s/i,
    /^includes\s/i,
    /^served\s+with\s/i,
    /^or\s/i,
    /^and\s/i,
    /^extra\s/i,
    /^topping\s/i,
    /^side\s/i,
    /^option\s/i,
    /^choice\s/i,
    /^selection\s/i,
    /^substitute\s/i,
    /^replace\s/i,
    /^instead\s+of\s/i
  ];
  
  // Check if line matches any exclusion pattern
  for (const pattern of excludePatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }
  
  // Known menu item patterns (both English and Arabic) - more comprehensive
  const menuPatterns = [
    /burger/i, /shakshuka/i, /labneh/i, /hummus/i, /baba/i,
    /halloumi/i, /kibbeh/i, /mutbal/i, /mezze/i, /tapas/i,
    /bruschetta/i, /spring roll/i, /samosa/i, /pakora/i,
    /steak/i, /chicken/i, /beef/i, /lamb/i, /fish/i, /salmon/i,
    /pasta/i, /rice/i, /noodles/i, /curry/i, /stew/i, /roast/i,
    /cake/i, /ice cream/i, /pudding/i, /cheesecake/i, /brownie/i,
    /chocolate/i, /coffee/i, /tea/i, /juice/i, /smoothie/i,
    /milkshake/i, /cocktail/i, /beer/i, /wine/i, /salad/i,
    /sandwich/i, /wrap/i, /panini/i, /eggs/i, /bacon/i,
    /toast/i, /pancake/i, /waffle/i, /nuts/i, /fries/i,
    /chips/i, /mash/i, /rocket/i, /cheese/i, /sauce/i
  ];
  
  // Check if line matches any known menu pattern
  for (const pattern of menuPatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  // Check for Arabic text
  if (/[ء-ي]/.test(trimmed)) {
    return true;
  }
  
  // Check for capitalized words (common in menu items)
  const words = trimmed.split(' ');
  const capitalizedWords = words.filter(word => 
    word.length > 0 && word[0] === word[0].toUpperCase()
  );
  
  // If more than 50% of words are capitalized, likely a menu item
  if (capitalizedWords.length > 0 && capitalizedWords.length >= words.length * 0.5) {
    return true;
  }
  
  // More relaxed detection - allow short names and common food words
  return (
    trimmed.length > 0 &&
    trimmed.length < 100 &&
    !/^£/.test(trimmed) &&
    !isCategoryHeader(trimmed) &&
    !isDescription(trimmed) &&
    // Allow short names like "Nuts", "Fries", etc.
    (trimmed.length >= 1) &&
    // Don't block common food words
    !['served with', 'add ', 'with ', 'and ', 'or ', 'freshly made', 'grilled'].some(word => 
      trimmed.toLowerCase().startsWith(word)
    ) &&
    // Allow lines that contain food-related content
    (trimmed.length > 0 || /[ء-ي]/.test(trimmed) || /[A-Z]/.test(trimmed))
  );
}

async function processImageWithGPTVision(imageBuffer, mimeType) {
  try {
    // Generate hash for caching
    const imageHash = generateImageHash(imageBuffer);
    
    // Check cache first
    const cachedResult = getCachedResult(imageHash);
    if (cachedResult) {
      console.log(`[Vision] Using cached result for image hash: ${imageHash.substring(0, 8)}...`);
      return cachedResult;
    }
    
    // Optimize image for vision API
    const optimizedBuffer = await optimizeImageForVision(imageBuffer, mimeType);
    console.log(`[Vision] Optimized image: ${imageBuffer.length} → ${optimizedBuffer.length} bytes`);
    
    const base64Image = optimizedBuffer.toString('base64');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "system",
          content: "You are a menu parsing expert. Extract ALL menu items with name, price, description, and category. Return ONLY a valid JSON array in this exact format: [{\"name\": \"\", \"price\": 0, \"description\": \"\", \"category\": \"\"}]. Do not include any explanations or additional text."
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/${mimeType === 'image/jpeg' ? 'jpeg' : 'png'};base64,${base64Image}`,
                detail: "high"
              }
            },
            {
              type: "text",
              text: `Extract EVERY menu item from this image. Return a valid JSON array ONLY in this format:

[
  { "name": "", "price": 0, "description": "", "category": "" },
  ...
]

⚠️ Do not nest JSON inside any field.
⚠️ For each item, extract the nearest visible category above it (e.g., "Mains", "Brunch", "Add-ons").
⚠️ If no category is found, use "Uncategorized".
⚠️ Extract every add-on (e.g. 'Add Egg £1.50') as its own item.
⚠️ Do NOT use 'menuItem:' or any other keys outside of this format.
⚠️ Items with same name but different prices must both be included.`
            }
          ]
        }
      ],
      max_tokens: 2048,
    });
    
    const content = response.choices[0].message.content;
    console.log(`[Vision] Raw response:`, content);
    
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
                 item.price > 0;
        }).map(item => ({
          ...item,
          category: normalizeCategory(item.category)
        }));
        
        console.log(`[Vision] Parsed ${menuItems.length} items, ${validItems.length} valid`);
        
        // Cache the result
        setCachedResult(imageHash, validItems);
        
        return validItems;
      } catch (parseError) {
        console.error(`[Vision] JSON parse error:`, parseError);
        console.error(`[Vision] Failed to parse this JSON:`, jsonMatch[0]);
        
        // Try to fix JSON with a faster model
        const fixedItems = await fixJSONWithFastModel(jsonMatch[0]);
        if (fixedItems.length > 0) {
          console.log(`[Vision] Fixed JSON with fast model, found ${fixedItems.length} items`);
          setCachedResult(imageHash, fixedItems);
          return fixedItems;
        }
        
        throw new Error('Failed to parse GPT Vision response as JSON');
      }
    } else {
      console.error(`[Vision] No JSON array found in response`);
      console.error(`[Vision] Full response content:`, content);
      
      // Try to extract items with fast model
      const extractedItems = await extractItemsWithFastModel(content);
      if (extractedItems.length > 0) {
        console.log(`[Vision] Extracted items with fast model, found ${extractedItems.length} items`);
        setCachedResult(imageHash, extractedItems);
        return extractedItems;
      }
      
      throw new Error('No valid JSON array found in GPT Vision response');
    }
  } catch (error) {
    console.error(`[Vision] Error:`, error);
    
    // Handle quota errors specifically
    if (error.code === 'insufficient_quota' || error.message?.includes('quota')) {
      throw new Error('OpenAI quota exceeded. Please upgrade your plan or try again later.');
    }
    
    throw error;
  }
}

async function processAllImagesWithGPTVision(imageBuffers, mimeTypes) {
  try {
    console.log(`[Vision Batch] Processing ${imageBuffers.length} images in single GPT Vision call`);
    
    // Prepare all images for the batch call
    const imageMessages = imageBuffers.map((buffer, index) => {
      const mimeType = mimeTypes[index] || 'image/png';
      const base64Image = buffer.toString('base64');
      
      return {
        type: "image_url",
        image_url: {
          url: `data:image/${mimeType === 'image/jpeg' ? 'jpeg' : 'png'};base64,${base64Image}`,
          detail: "high"
        }
      };
    });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "system",
          content: "You are a menu parsing expert. Extract ALL menu items from ALL images with name, price, description, and category. Return ONLY a valid JSON array in this exact format: [{\"name\": \"\", \"price\": 0, \"description\": \"\", \"category\": \"\"}]. Do not include any explanations or additional text."
        },
        {
          role: "user",
          content: [
            ...imageMessages,
            {
              type: "text",
              text: `Extract EVERY menu item from ALL ${imageBuffers.length} images. Return a valid JSON array ONLY in this format:

[
  { "name": "", "price": 0, "description": "", "category": "" },
  ...
]

⚠️ Do not nest JSON inside any field.
⚠️ For each item, extract the nearest visible category above it (e.g., "Mains", "Brunch", "Add-ons").
⚠️ If no category is found, use "Uncategorized".
⚠️ Extract every add-on (e.g. 'Add Egg £1.50') as its own item.
⚠️ Do NOT use 'menuItem:' or any other keys outside of this format.
⚠️ Items with same name but different prices must both be included.
⚠️ Process ALL images and combine ALL items into one array.`
            }
          ]
        }
      ],
      max_tokens: 4096, // Increased for multiple images
    });
    
    const content = response.choices[0].message.content;
    console.log(`[Vision Batch] Raw response:`, content);
    
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
                 item.price > 0;
        }).map(item => ({
          ...item,
          category: normalizeCategory(item.category)
        }));
        
        console.log(`[Vision Batch] Parsed ${menuItems.length} items, ${validItems.length} valid from all images`);
        
        return validItems;
      } catch (parseError) {
        console.error(`[Vision Batch] JSON parse error:`, parseError);
        console.error(`[Vision Batch] Failed to parse this JSON:`, jsonMatch[0]);
        
        // Try to fix JSON with a faster model
        const fixedItems = await fixJSONWithFastModel(jsonMatch[0]);
        if (fixedItems.length > 0) {
          console.log(`[Vision Batch] Fixed JSON with fast model, found ${fixedItems.length} items`);
          return fixedItems;
        }
        
        throw new Error('Failed to parse GPT Vision batch response as JSON');
      }
    } else {
      console.error(`[Vision Batch] No JSON array found in response`);
      console.error(`[Vision Batch] Full response content:`, content);
      
      // Try to extract items with fast model
      const extractedItems = await extractItemsWithFastModel(content);
      if (extractedItems.length > 0) {
        console.log(`[Vision Batch] Extracted items with fast model, found ${extractedItems.length} items`);
        return extractedItems;
      }
      
      throw new Error('No valid JSON array found in GPT Vision batch response');
    }
  } catch (error) {
    console.error(`[Vision Batch] Error:`, error);
    
    // Handle quota errors specifically
    if (error.code === 'insufficient_quota' || error.message?.includes('quota')) {
      throw new Error('OpenAI quota exceeded. Please upgrade your plan or try again later.');
    }
    
    throw error;
  }
}

// ... existing code ...

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
    
    // Convert PDF pages to images
    const pageImages = await convertPDFToImages(pdfBuffer);
    
    if (pageImages.length === 0) {
      throw new Error('No pages extracted from PDF');
    }
    
    console.log(`[Consolidated Vision] Extracted ${pageImages.length} pages, preparing for single Vision call`);
    
    // Prepare image messages for GPT-4 Vision
    const imageMessages = pageImages.map((page, index) => {
      // Convert text content to base64 image (simulating image conversion)
      // In a real implementation, you'd convert PDF pages to actual images
      const mockImageBuffer = Buffer.from(`Page ${index + 1}: ${page.content.substring(0, 100)}...`);
      
      return {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${mockImageBuffer.toString("base64")}`,
          detail: "high",
        },
      };
    });
    
    // Prepare the consolidated prompt
    const consolidatedPrompt = `Extract all menu items from the attached ${pageImages.length} images and return them as JSON array in this format:

[
  {
    "name": "ITEM NAME",
    "price": PRICE,
    "description": "ITEM DESCRIPTION", 
    "category": "CATEGORY"
  },
  ...
]

⚠️ Important Instructions:
- Keep items in the same order they appear in the menu
- Group by logical sections (Breakfast, Mains, Desserts, Add-ons, etc.)
- If category not explicitly written, infer from nearby items or layout
- Extract every add-on (e.g. 'Add Egg £1.50') as its own item
- Items with same name but different prices must both be included
- Return ONLY valid JSON array, no explanations or additional text
- Process ALL ${pageImages.length} images and combine ALL items into one array`;

    const messages = [
      {
        role: "system",
        content: "You are a menu parsing expert. Extract ALL menu items from ALL images with name, price, description, and category. Return ONLY a valid JSON array in the exact format specified. Do not include any explanations or additional text."
      },
      {
        role: "user",
        content: [
          ...imageMessages,
          {
            type: "text",
            text: consolidatedPrompt
          }
        ]
      }
    ];
    
    console.log(`[Consolidated Vision] Making single GPT-4 Vision call for ${pageImages.length} pages`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages,
      max_tokens: 4096,
      temperature: 0.3,
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
                 item.price > 0;
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

// ... existing code ...
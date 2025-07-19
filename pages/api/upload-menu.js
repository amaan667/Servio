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

  const poller = await client.beginAnalyzeDocument("prebuilt-layout", file, {
    contentType: "application/pdf", // or "image/png" etc.
  });

  const result = await poller.pollUntilDone();

  // Extract menu items from layout analysis
  const menuItems = extractFromLayout(result);
  
  if (menuItems.length > 0) {
    console.log(`[Layout] Found ${menuItems.length} items via layout extraction`);
    return menuItems;
  }

  // Fallback to line-by-line extraction
  let output = [];
  for (const page of result.pages || []) {
    for (const line of page.lines || []) {
      output.push(line.content);
    }
  }

  return output.join('\n');
}

function extractFromLayout(result) {
  const menuItems = [];
  let currentCategory = 'Uncategorized';

  for (const page of result.pages || []) {
    console.log(`[Layout] Processing page ${page.pageNumber}`);
    
    // Process tables first (most structured)
    if (page.tables && page.tables.length > 0) {
      console.log(`[Layout] Found ${page.tables.length} tables`);
      for (const table of page.tables) {
        const tableItems = extractFromTable(table, currentCategory);
        menuItems.push(...tableItems);
      }
    }

    // Process lines for non-table content
    if (page.lines && page.lines.length > 0) {
      console.log(`[Layout] Processing ${page.lines.length} lines`);
      const lineItems = extractFromLines(page.lines, currentCategory);
      menuItems.push(...lineItems);
    }
  }

  return menuItems;
}

function extractFromTable(table, currentCategory) {
  const items = [];
  
  for (const row of table.rows || []) {
    const cells = row.cells || [];
    if (cells.length < 2) continue; // Need at least name and price
    
    let itemName = '';
    let itemPrice = null;
    let itemDescription = '';
    
    // Analyze cell content and position
    for (const cell of cells) {
      const content = cell.content?.trim() || '';
      if (!content) continue;
      
      // Check if cell contains price
      const priceMatch = content.match(/£\s?(\d+(?:\.\d{1,2})?)/);
      if (priceMatch) {
        itemPrice = parseFloat(priceMatch[1]);
        // Remove price from content for name
        itemName = content.replace(/£\s?\d+(?:\.\d{1,2})?/, '').trim();
      } else {
        // If no price found, this might be the name or description
        if (!itemName) {
          itemName = content;
        } else {
          itemDescription += (itemDescription ? ' ' : '') + content;
        }
      }
    }
    
    // Validate and add item
    if (itemName && itemPrice) {
      items.push({
        name: itemName,
        price: itemPrice,
        category: currentCategory,
        description: itemDescription || undefined
      });
      console.log(`[Table] Extracted: ${itemName} - £${itemPrice} (${currentCategory})`);
    }
  }
  
  return items;
}

function extractFromLines(lines, currentCategory) {
  const items = [];
  let currentItem = null;
  
  for (const line of lines) {
    const content = line.content?.trim() || '';
    if (!content) continue;
    
    // Check if line is a category header
    if (isCategoryHeader(content)) {
      currentCategory = detectCategory(content);
      console.log(`[Layout] Detected category: ${content} → ${currentCategory}`);
      continue;
    }
    
    // Check if line contains both name and price
    const inlineMatch = content.match(/^(.*?)[.\-–—]*\s*£\s?(\d+(?:\.\d{1,2})?)/);
    if (inlineMatch) {
      const name = inlineMatch[1].trim();
      const price = parseFloat(inlineMatch[2]);
      
      if (isLikelyItemName(name)) {
        items.push({
          name: name,
          price: price,
          category: currentCategory
        });
        console.log(`[Layout] Inline item: ${name} - £${price} (${currentCategory})`);
      }
      continue;
    }
    
    // Check if line is just a price (might be paired with previous item)
    const priceMatch = content.match(/£\s?(\d+(?:\.\d{1,2})?)/);
    if (priceMatch && currentItem) {
      currentItem.price = parseFloat(priceMatch[1]);
      items.push(currentItem);
      console.log(`[Layout] Completed item: ${currentItem.name} - £${currentItem.price} (${currentCategory})`);
      currentItem = null;
      continue;
    }
    
    // Check if line is a likely item name
    if (isLikelyItemName(content)) {
      if (currentItem) {
        // Save previous incomplete item
        items.push(currentItem);
        console.log(`[Layout] Saved incomplete item: ${currentItem.name}`);
      }
      currentItem = { name: content, category: currentCategory };
      continue;
    }
    
    // Check if line is a description
    if (isDescription(content) && currentItem) {
      currentItem.description = content;
      continue;
    }
  }
  
  // Handle any remaining incomplete item
  if (currentItem) {
    items.push(currentItem);
    console.log(`[Layout] Final incomplete item: ${currentItem.name}`);
  }
  
  return items;
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
        const azureResult = await analyzeMenuWithAzure(filePath);
        console.log("Azure Form Recognizer extraction successful");
        
        // Check if we got structured menu items from layout analysis
        if (Array.isArray(azureResult)) {
          console.log("Using layout-based extraction");
          const structuredMenu = azureResult;
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
          // Fallback to line-by-line parsing
          text = azureResult;
        }
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
      console.log('Structured menu from line parsing:', structuredMenu);

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
    'HOUMOUS JAM', 'GRILLED HALLOUMI', 'KIBBEH', 'MUTBAL'
  ];
  
  return (
    knownCategories.some(cat => line.toUpperCase().includes(cat)) ||
    (line.length > 2 && line.length < 40 && line === line.toUpperCase() && !/^£/.test(line) && !/[ء-ي]/.test(line))
  );
}

function isDescription(line) {
  // More lenient description detection
  return (
    (/^[a-z]/.test(line) && line.length > 20) ||
    line.length > 100 ||
    /[.!?]$/.test(line) ||
    (line.toLowerCase().includes('served with') && line.length > 30) ||
    (line.toLowerCase().includes('freshly made') && line.length > 30) ||
    (line.toLowerCase().includes('grilled') && line.length > 50)
  );
}

function parseMenuFromSeparatedLines(lines) {
  const menu = [];
  let currentCategory = 'Uncategorized';
  let currentItem = null;
  let state = 'scanning'; // scanning, item_name, item_description, price

  // Semantic category matching
  const categoryPatterns = {
    starters: /^(starters?|appetizers?|entrees?|small plates?)/i,
    mains: /^(main|mains|entrees?|dishes?|plates?)/i,
    desserts: /^(desserts?|sweets?|puddings?)/i,
    drinks: /^(drinks?|beverages?|coffee|tea|juices?|smoothies?)/i,
    sides: /^(sides?|accompaniments?|extras?)/i
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    console.log(`[Line ${i}] State: ${state}, Processing:`, JSON.stringify(line));

    // State machine logic
    switch (state) {
      case 'scanning':
        // Look for category headers
        if (isCategoryHeader(line)) {
          currentCategory = detectCategory(line);
          console.log(`[Line ${i}] Detected category: ${currentCategory}`);
          state = 'scanning';
          continue;
        }
        
        // Look for item names
        if (isLikelyItemName(line)) {
          currentItem = { name: line, category: currentCategory };
          state = 'item_name';
          console.log(`[Line ${i}] Started item: ${line}`);
          continue;
        }
        
        // Look for standalone prices
        const priceMatch = line.match(/£\s?(\d+(?:\.\d{1,2})?)/);
        if (priceMatch && currentItem) {
          currentItem.price = parseFloat(priceMatch[1]);
          menu.push(currentItem);
          console.log(`[Line ${i}] Completed item with price: ${currentItem.name} - £${currentItem.price}`);
          currentItem = null;
          state = 'scanning';
          continue;
        }
        break;

      case 'item_name':
        // Check if line contains price
        const inlinePriceMatch = line.match(/^(.*?)[.\-–—]*\s*£\s?(\d+(?:\.\d{1,2})?)/);
        if (inlinePriceMatch) {
          const name = inlinePriceMatch[1].trim();
          const price = parseFloat(inlinePriceMatch[2]);
          currentItem.name = name || currentItem.name;
          currentItem.price = price;
          menu.push(currentItem);
          console.log(`[Line ${i}] Completed inline item: ${currentItem.name} - £${currentItem.price}`);
          currentItem = null;
          state = 'scanning';
          continue;
        }
        
        // Check if line is just a price
        const standalonePriceMatch = line.match(/£\s?(\d+(?:\.\d{1,2})?)/);
        if (standalonePriceMatch) {
          currentItem.price = parseFloat(standalonePriceMatch[1]);
          menu.push(currentItem);
          console.log(`[Line ${i}] Completed item with standalone price: ${currentItem.name} - £${currentItem.price}`);
          currentItem = null;
          state = 'scanning';
          continue;
        }
        
        // Check if line continues the item name
        if (isItemNameContinuation(line)) {
          currentItem.name += ' ' + line;
          console.log(`[Line ${i}] Extended item name: ${currentItem.name}`);
          continue;
        }
        
        // Check if line is a description
        if (isDescription(line)) {
          currentItem.description = line;
          state = 'item_description';
          console.log(`[Line ${i}] Added description: ${line}`);
          continue;
        }
        
        // If none of the above, assume it's a new item
        if (isLikelyItemName(line)) {
          // Save current item without price
          if (currentItem) {
            menu.push(currentItem);
            console.log(`[Line ${i}] Saved incomplete item: ${currentItem.name}`);
          }
          currentItem = { name: line, category: currentCategory };
          console.log(`[Line ${i}] Started new item: ${line}`);
          continue;
        }
        break;

      case 'item_description':
        // Look for price after description
        const descPriceMatch = line.match(/£\s?(\d+(?:\.\d{1,2})?)/);
        if (descPriceMatch) {
          currentItem.price = parseFloat(descPriceMatch[1]);
          menu.push(currentItem);
          console.log(`[Line ${i}] Completed item after description: ${currentItem.name} - £${currentItem.price}`);
          currentItem = null;
          state = 'scanning';
          continue;
        }
        
        // Continue description or start new item
        if (isLikelyItemName(line)) {
          if (currentItem) {
            menu.push(currentItem);
            console.log(`[Line ${i}] Saved incomplete item: ${currentItem.name}`);
          }
          currentItem = { name: line, category: currentCategory };
          state = 'item_name';
          console.log(`[Line ${i}] Started new item after description: ${line}`);
          continue;
        }
        
        // Continue description
        if (isDescription(line)) {
          currentItem.description += ' ' + line;
          console.log(`[Line ${i}] Extended description: ${currentItem.description}`);
          continue;
        }
        break;
    }
  }

  // Handle any remaining incomplete item
  if (currentItem) {
    menu.push(currentItem);
    console.log(`Final incomplete item: ${currentItem.name}`);
  }

  // Post-processing
  const processedMenu = postProcessMenu(menu);
  console.log('Final processed menu items:', processedMenu);
  return processedMenu;
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
    
    // Check if item name is valid
    const isValidName = item.name && item.name.trim().length > 0;
    
    // Check if item passes menu item validation
    const passesValidation = isValidMenuItem(item.name);
    
    if (!hasValidPrice) {
      console.log(`[Filter] Excluded item with invalid price: "${item.name}" (price: ${item.price})`);
      return false;
    }
    
    if (!isValidName) {
      console.log(`[Filter] Excluded item with invalid name: "${item.name}"`);
      return false;
    }
    
    if (!passesValidation) {
      console.log(`[Filter] Excluded non-menu item: "${item.name}"`);
      return false;
    }
    
    return true;
  });
  
  console.log(`[Filter] Filtered ${items.length} items down to ${validItems.length} valid items`);
  return validItems;
} 
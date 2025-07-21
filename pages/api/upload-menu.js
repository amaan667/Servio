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

// --- DYNAMIC MENU ANALYZER --- //

// Analyze the uploaded menu to understand its structure and cuisine
async function analyzeMenuStructure(text) {
  log('Analyzing menu structure and cuisine type');
  
  const analysis = {
    cuisine: 'unknown',
    restaurantType: 'casual',
    sections: [],
    priceRange: { min: 0, max: 0, avg: 0 },
    language: 'english',
    categories: []
  };

  // Extract all prices to understand price range
  const priceMatches = text.match(/£[\d.,]+|\$[\d.,]+|€[\d.,]+/g) || [];
  const prices = priceMatches.map(p => parseFloat(p.replace(/[£$€,]/g, ''))).filter(p => p > 0);
  
  if (prices.length > 0) {
    analysis.priceRange = {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length
    };
  }

  // Detect cuisine type based on dish names and keywords
  const cuisineIndicators = {
    'middle-eastern': ['labneh', 'kibbeh', 'shakshuka', 'houmous', 'hummus', 'tahini', 'za\'atar', 'shawarma', 'falafel', 'mutbal', 'baba ghanoush', 'kofta', 'kebab'],
    'italian': ['pasta', 'pizza', 'risotto', 'gnocchi', 'bruschetta', 'antipasti', 'tiramisu', 'gelato', 'carbonara', 'bolognese', 'margherita', 'parmigiana'],
    'mexican': ['tacos', 'burritos', 'quesadillas', 'enchiladas', 'guacamole', 'nachos', 'churros', 'salsa', 'jalapeño', 'tortilla', 'chipotle'],
    'asian': ['sushi', 'ramen', 'pad thai', 'dim sum', 'tempura', 'yakitori', 'pho', 'bibimbap', 'teriyaki', 'miso', 'wasabi', 'edamame'],
    'indian': ['curry', 'tandoori', 'biryani', 'naan', 'samosa', 'dosa', 'masala', 'dal', 'paneer', 'chapati', 'vindaloo', 'korma'],
    'american': ['burger', 'wings', 'bbq', 'ribs', 'mac and cheese', 'coleslaw', 'cornbread', 'pancakes', 'waffles', 'club sandwich'],
    'french': ['croissant', 'baguette', 'coq au vin', 'ratatouille', 'crème brûlée', 'escargot', 'bouillabaisse', 'quiche', 'crepe'],
    'greek': ['gyros', 'souvlaki', 'moussaka', 'tzatziki', 'dolmades', 'spanakopita', 'baklava', 'feta', 'olives'],
    'chinese': ['chow mein', 'kung pao', 'sweet and sour', 'spring rolls', 'dumpling', 'fried rice', 'dim sum', 'szechuan'],
    'thai': ['pad thai', 'tom yum', 'green curry', 'red curry', 'massaman', 'som tam', 'mango sticky rice'],
    'japanese': ['sushi', 'sashimi', 'tempura', 'ramen', 'udon', 'yakitori', 'miso', 'teriyaki', 'bento']
  };

  let maxMatches = 0;
  const textLower = text.toLowerCase();
  
  for (const [cuisine, indicators] of Object.entries(cuisineIndicators)) {
    const matches = indicators.filter(indicator => textLower.includes(indicator)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      analysis.cuisine = cuisine;
    }
  }

  // Detect restaurant type based on price range and vocabulary
  if (analysis.priceRange.avg > 25) {
    analysis.restaurantType = 'fine-dining';
  } else if (analysis.priceRange.avg < 8) {
    analysis.restaurantType = 'fast-food';
  } else if (textLower.includes('café') || textLower.includes('coffee') || textLower.includes('breakfast')) {
    analysis.restaurantType = 'cafe';
  } else if (textLower.includes('bar') || textLower.includes('pub')) {
    analysis.restaurantType = 'bar';
  }

  // Extract section headers dynamically
  const lines = text.split('\n');
  const sectionPatterns = [
    /^[A-Z\s&]{4,}$/,  // ALL CAPS sections
    /^[A-Z][a-z\s&]+:?\s*$/,  // Title Case sections
    /^\*{2,}[^*]+\*{2,}$/,  // **SECTION**
    /^={3,}[^=]+={3,}$/,  // ===SECTION===
    /^-{3,}[^-]+-{3,}$/,  // ---SECTION---
  ];

  const commonSections = ['menu', 'starters', 'mains', 'desserts', 'beverages', 'appetizers', 'salads', 'sandwiches', 'breakfast', 'lunch', 'dinner', 'specials'];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 3 && trimmed.length < 30) {
      // Check if it matches section patterns
      let isSection = false;
      for (const pattern of sectionPatterns) {
        if (pattern.test(trimmed) && !priceMatches.some(p => trimmed.includes(p))) {
          isSection = true;
          break;
        }
      }
      
      // Or if it's a common section word
      const lowerTrimmed = trimmed.toLowerCase();
      if (commonSections.some(section => lowerTrimmed.includes(section))) {
        isSection = true;
      }
      
      if (isSection) {
        const cleanSection = trimmed.replace(/[*=:-]/g, '').trim();
        if (!analysis.sections.includes(cleanSection) && cleanSection.length > 2) {
          analysis.sections.push(cleanSection);
        }
      }
    }
  }

  // Generate dynamic categories based on analysis
  analysis.categories = generateDynamicCategories(analysis);
  
  log('Menu analysis complete:', {
    cuisine: analysis.cuisine,
    type: analysis.restaurantType,
    priceRange: analysis.priceRange,
    sections: analysis.sections.length,
    categories: analysis.categories.length
  });
  
  return analysis;
}

// Generate categories dynamically based on menu analysis
function generateDynamicCategories(analysis) {
  const baseCategories = ['Mains', 'Beverages', 'Desserts', 'Sides'];
  const additionalCategories = [];

  // Add cuisine-specific categories
  switch (analysis.cuisine) {
    case 'middle-eastern':
      additionalCategories.push('Mezze', 'Grills', 'Wraps', 'Hot-Dishes');
      break;
    case 'italian':
      additionalCategories.push('Antipasti', 'Pasta', 'Pizza', 'Risotto');
      break;
    case 'mexican':
      additionalCategories.push('Appetizers', 'Tacos', 'Burritos', 'Quesadillas');
      break;
    case 'asian':
    case 'chinese':
    case 'japanese':
    case 'thai':
      additionalCategories.push('Appetizers', 'Sushi', 'Noodles', 'Rice', 'Curry');
      break;
    case 'indian':
      additionalCategories.push('Appetizers', 'Curry', 'Tandoor', 'Breads', 'Rice');
      break;
    case 'french':
      additionalCategories.push('Starters', 'Entrees', 'Cheese', 'Wine');
      break;
    case 'greek':
      additionalCategories.push('Mezze', 'Grills', 'Salads');
      break;
    default:
      additionalCategories.push('Appetizers', 'Salads', 'Sandwiches', 'Burgers');
  }

  // Add restaurant-type specific categories
  switch (analysis.restaurantType) {
    case 'cafe':
      additionalCategories.push('Breakfast', 'Light-Bites', 'Coffee', 'Pastries');
      break;
    case 'fast-food':
      additionalCategories.push('Burgers', 'Kids', 'Combo-Meals', 'Snacks');
      break;
    case 'fine-dining':
      additionalCategories.push('Starters', 'Wine', 'Tasting-Menu', 'Cheese');
      break;
    case 'bar':
      additionalCategories.push('Bar-Snacks', 'Cocktails', 'Beer', 'Wine');
      break;
  }

  // Add detected sections as categories if they make sense
  for (const section of analysis.sections) {
    const normalized = section
      .replace(/[^a-zA-Z\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/^(the|our|daily|fresh|house|signature|chef|special)/i, '');
    
    if (normalized.length > 2 && normalized.length < 20 && !normalized.match(/^(menu|page|section)$/i)) {
      additionalCategories.push(normalized.charAt(0).toUpperCase() + normalized.slice(1));
    }
  }

  // Remove duplicates and return
  const allCategories = [...new Set([...baseCategories, ...additionalCategories])];
  
  // Ensure we don't have too many categories (max 15)
  return allCategories.slice(0, 15);
}

// Dynamic categorization based on menu analysis
function categorizeDynamic(itemName, price, menuAnalysis) {
  const name = itemName.toLowerCase();
  const numPrice = parseFloat(price) || 0;
  
  // Use detected sections first if item matches
  for (const section of menuAnalysis.sections) {
    const sectionLower = section.toLowerCase();
    const sectionWords = sectionLower.split(/\s+/);
    
    // Check if item name contains any words from the section
    if (sectionWords.some(word => word.length > 3 && name.includes(word))) {
      const categoryName = section.replace(/\s+/g, '-').replace(/[^a-zA-Z-]/g, '');
      if (menuAnalysis.categories.includes(categoryName)) {
        return categoryName;
      }
    }
  }

  // Cuisine-specific logic
  switch (menuAnalysis.cuisine) {
    case 'middle-eastern':
      if (name.match(/(labneh|kibbeh|houmous|hummus|mutbal|bourak|mezze)/)) return 'Mezze';
      if (name.match(/(shawarma|wrap)/)) return 'Wraps';
      if (name.match(/(grilled|kebab|kofta)/)) return 'Grills';
      break;
      
    case 'italian':
      if (name.match(/(bruschetta|antipasti|caprese|prosciutto)/)) return 'Antipasti';
      if (name.match(/(spaghetti|penne|ravioli|linguine|carbonara|bolognese)/)) return 'Pasta';
      if (name.match(/(margherita|pepperoni|quattro|pizza)/)) return 'Pizza';
      if (name.match(/(risotto)/)) return 'Risotto';
      break;
      
    case 'mexican':
      if (name.match(/(nachos|guacamole|salsa)/)) return 'Appetizers';
      if (name.match(/(taco|soft shell|hard shell)/)) return 'Tacos';
      if (name.match(/(burrito)/)) return 'Burritos';
      if (name.match(/(quesadilla)/)) return 'Quesadillas';
      break;
      
    case 'asian':
    case 'japanese':
      if (name.match(/(sushi|sashimi|maki|roll)/)) return 'Sushi';
      if (name.match(/(ramen|udon|noodle)/)) return 'Noodles';
      if (name.match(/(rice|fried rice|teriyaki)/)) return 'Rice';
      break;
      
    case 'indian':
      if (name.match(/(samosa|pakora|chaat)/)) return 'Appetizers';
      if (name.match(/(curry|masala|vindaloo|korma)/)) return 'Curry';
      if (name.match(/(tandoori|tikka)/)) return 'Tandoor';
      if (name.match(/(naan|roti|chapati|bread)/)) return 'Breads';
      if (name.match(/(biryani|rice)/)) return 'Rice';
      break;
  }

  // Universal patterns
  if (name.match(/(coffee|espresso|latte|cappuccino|mocha|americano|macchiato|cortado)/)) return 'Beverages';
  if (name.match(/(tea|chai|matcha|herbal|green tea|black tea)/)) return 'Beverages';
  if (name.match(/(juice|smoothie|soda|water|beer|wine|cocktail|mocktail)/)) return 'Beverages';
  if (name.match(/(kids?|children|mini|junior)/)) return 'Kids';
  if (name.match(/(cake|ice cream|dessert|sweet|chocolate|pie|tart|pudding|brownie)/)) return 'Desserts';
  if (name.match(/(salad|greens|caesar|greek|garden)/)) return 'Salads';
  if (name.match(/(sandwich|burger|wrap|panini|club|melt)/)) return 'Sandwiches';
  
  // Price-based categorization adjusted to menu's price range
  const avgPrice = menuAnalysis.priceRange.avg;
  if (avgPrice > 0) {
    if (numPrice < avgPrice * 0.4) return 'Sides';
    if (numPrice > avgPrice * 1.8) return 'Specials';
  } else {
    // Fallback price thresholds
    if (numPrice < 5) return 'Sides';
    if (numPrice > 20) return 'Specials';
  }
  
  return 'Mains';
}

// --- UTILS --- //
function generateHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function getCache(hash) {
  try {
    const { data } = await supabase.from('menu_cache').select('result').eq('hash', hash).single();
    return data ? data.result : null;
  } catch {
    return null;
  }
}

async function setCache(hash, result) {
  try {
    await supabase.from('menu_cache').upsert({ 
      hash, 
      result, 
      created_at: new Date().toISOString() 
    });
  } catch (error) {
    log('Cache save failed:', error.message);
  }
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
  try {
    const { text } = await pdf(buffer);
    if (!text || text.length < 20) {
      throw new Error('No readable text extracted from PDF');
    }
    return text;
  } catch (error) {
    log('PDF extraction error:', error.message);
    throw new Error('Failed to extract text from PDF: ' + error.message);
  }
}

// Updated extraction function with dynamic analysis
async function extractMenuItemsFromText(text) {
  log('Starting dynamic menu extraction');
  try {
    // Step 1: Analyze the menu structure
    const menuAnalysis = await analyzeMenuStructure(text);
    
    // Step 2: Create dynamic system prompt
    const systemPrompt = `You are extracting menu items from a ${menuAnalysis.cuisine} ${menuAnalysis.restaurantType} restaurant.

DETECTED MENU STRUCTURE:
- Cuisine: ${menuAnalysis.cuisine}
- Type: ${menuAnalysis.restaurantType}  
- Price Range: £${menuAnalysis.priceRange.min}-£${menuAnalysis.priceRange.max} (avg: £${menuAnalysis.priceRange.avg.toFixed(2)})
- Detected Sections: ${menuAnalysis.sections.join(', ')}

USE THESE CATEGORIES ONLY (choose the most appropriate):
${menuAnalysis.categories.map(cat => `- "${cat}"`).join('\n')}

STRICT RULES:
1. Extract ONLY items with clear names and prices
2. Use the detected sections above as context for categorization
3. Match the cuisine style and restaurant type
4. If uncertain about category, use "Mains" as default
5. Never use "Uncategorized" or create new categories
6. Return ONLY a valid JSON array
7. Ensure every item has: name, price (as number), description, available (true), category

FORMAT REQUIRED:
[{"name": "Item Name", "price": 12.50, "description": "Brief description", "available": true, "category": "Exact-Category-Name"}]`;

    const userPrompt = `Extract ALL menu items from this ${menuAnalysis.cuisine} restaurant menu. Focus on items with clear prices and names:\n\n${text}`;

    log('Sending dynamic prompt to GPT-4o');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4000,
      temperature: 0.1,
    });
    
    const content = response.choices[0].message.content;
    log('GPT-4o response received, length:', content?.length || 0);
    
    // Extract JSON from response
    const jsonMatch = content.match(/\[.*\]/s);
    if (!jsonMatch) {
      log('ERROR: No JSON array found in GPT response');
      throw new Error('No valid JSON found in response');
    }
    
    let menuItems;
    try {
      menuItems = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      log('ERROR: JSON parse failed:', parseError.message);
      throw new Error('Invalid JSON in GPT response');
    }
    
    if (!Array.isArray(menuItems)) {
      throw new Error('Response is not an array');
    }
    
    // Step 3: Apply dynamic fallback categorization and validation
    const processedItems = menuItems
      .filter(item => {
        // Basic validation
        if (!item.name || typeof item.name !== 'string') return false;
        if (item.price === undefined || item.price === null || isNaN(parseFloat(item.price))) return false;
        return true;
      })
      .map(item => {
        // Ensure price is a number
        item.price = parseFloat(item.price);
        
        // Clean up the name
        item.name = item.name.replace(/[£$€]\d+\.?\d*/g, '').trim();
        
        // Fix category if needed
        if (!item.category || !menuAnalysis.categories.includes(item.category)) {
          log(`Applying dynamic categorization for: ${item.name} (was: ${item.category})`);
          item.category = categorizeDynamic(item.name, item.price, menuAnalysis);
        }
        
        // Ensure category exists in our dynamic list
        if (!menuAnalysis.categories.includes(item.category)) {
          log(`Final fallback to Mains for: ${item.name}`);
          item.category = 'Mains';
        }
        
        // Ensure other required fields
        item.available = item.available !== false;
        item.description = item.description || '';
        
        return item;
      });
    
    // Log results
    const categoryCount = {};
    processedItems.forEach(item => {
      categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
    });
    
    log(`Successfully extracted ${processedItems.length} items:`, categoryCount);
    
    return processedItems;
  } catch (error) {
    log('ERROR in dynamic extraction:', error.message);
    throw error;
  }
}

// --- DEDUPLICATION --- //
function deduplicateMenuItems(items) {
  const seen = new Set();
  const unique = [];
  
  for (const item of items) {
    // Create a more sophisticated key for deduplication
    const key = `${item.name?.toLowerCase().replace(/[^a-z0-9]/g, '')}-${item.price}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    } else {
      log(`Duplicate removed: ${item.name} - £${item.price}`);
    }
  }
  
  return unique;
}

// --- MAIN API HANDLER --- //
async function handler(req, res) {
  log('API request received', {
    method: req.method,
    contentType: req.headers['content-type'],
    hasFile: !!req.file
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check OpenAI quota
  if (!(await checkOpenAIQuota())) {
    return res.status(429).json({ 
      error: 'OpenAI quota exceeded. Please top up your account.',
      code: 'QUOTA_EXCEEDED'
    });
  }

  const processFile = async (filePath, mimeType, venueId) => {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = generateHash(fileBuffer);
    
    // Check cache first
    const cached = await getCache(hash);
    if (cached) {
      log('Using cached result');
      return cached;
    }

    if (mimeType === 'application/pdf') {
      const text = await extractTextFromPDF(fileBuffer);
      const extracted = await extractMenuItemsFromText(text);
      
      // Cache the result
      await setCache(hash, extracted);
      return extracted;
    } else {
      throw new Error('Unsupported file type. Please upload a PDF file.');
    }
  };

  // Handle multipart upload
  upload.single('menu')(req, res, async (err) => {
    if (err) {
      log('Upload error:', err.message);
      return res.status(500).json({ 
        error: 'File upload failed', 
        detail: err.message 
      });
    }

    const filePath = req.file?.path;
    const mimeType = req.file?.mimetype;
    const venueId = req.body.venueId || req.query.venueId;

    if (!filePath || !mimeType || !venueId) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['file', 'mimeType', 'venueId'],
        received: { filePath: !!filePath, mimeType: !!mimeType, venueId: !!venueId }
      });
    }

    try {
      log('Processing file:', { mimeType, venueId });
      
      const items = await processFile(filePath, mimeType, venueId);
      const deduped = deduplicateMenuItems(items);
      
      if (!deduped.length) {
        throw new Error('No valid menu items found in the uploaded file');
      }
      
      // Insert to database
      log(`Inserting ${deduped.length} items into database`);
      const { data, error } = await supabase
        .from('menu_items')
        .upsert(
          deduped.map(item => ({
            ...item,
            venue_id: venueId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })),
          { onConflict: ['venue_id', 'name'] }
        );
      
      if (error) {
        log('Database error:', error);
        throw new Error('Failed to save menu items to database: ' + error.message);
      }
      
      // Success response
      const categoryBreakdown = {};
      deduped.forEach(item => {
        categoryBreakdown[item.category] = (categoryBreakdown[item.category] || 0) + 1;
      });
      
      log('Extraction completed successfully');
      res.status(200).json({ 
        success: true, 
        count: deduped.length, 
        categories: Object.keys(categoryBreakdown).length,
        categoryBreakdown,
        items: deduped
      });
      
    } catch (error) {
      log('Processing error:', error.message);
      res.status(500).json({ 
        error: 'Menu extraction failed', 
        detail: error.message,
        code: 'EXTRACTION_FAILED'
      });
    } finally {
      // Cleanup uploaded file
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          log('Temporary file cleaned up');
        } catch (cleanupError) {
          log('File cleanup failed:', cleanupError.message);
        }
      }
    }
  });
}

export default handler;
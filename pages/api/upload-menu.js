import multer from 'multer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import download from 'download';
import vision from '@google-cloud/vision';
import OpenAI from 'openai';

const upload = multer({ dest: '/tmp' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const client = new vision.ImageAnnotatorClient();

export const config = { api: { bodyParser: false } };

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

async function pdfToImagesWithConvertAPI(pdfPath, outputDir) {
  const API_SECRET = process.env.CONVERTAPI_SECRET;
  const form = new FormData();
  form.append('File', fs.createReadStream(pdfPath)); // Capital F

  // Debug logs
  console.log('[DEBUG] File exists:', fs.existsSync(pdfPath), 'Size:', fs.statSync(pdfPath).size);
  console.log('[DEBUG] FormData headers:', form.getHeaders());

  const endpoint = `https://v2.convertapi.com/convert/pdf/to/png?Secret=${API_SECRET}`;

  const response = await axios.post(endpoint, form, {
    headers: form.getHeaders()
  });

  if (response.data && response.data.Files) {
    fs.mkdirSync(outputDir, { recursive: true });
    const imagePaths = [];
    await Promise.all(response.data.Files.map(async (file, idx) => {
      const imgPath = `${outputDir}/page_${idx + 1}.png`;
      await download(file.Url, outputDir, { filename: `page_${idx + 1}.png` });
      imagePaths.push(imgPath);
      console.log(`Downloaded page_${idx + 1}.png`);
    }));
    return imagePaths;
  } else {
    throw new Error('Unexpected API response: ' + JSON.stringify(response.data));
  }
}

export default async function handler(req, res) {
  await runMiddleware(req, res, upload.single('menu'));
  try {
    // 1. Read file
    const filePath = req.file.path;
    const outputDir = `/tmp/pdf_images_${Date.now()}`;
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('[MENU_EXTRACTION] Uploaded file path:', filePath);
    // Debug: Check if CONVERTAPI_SECRET is set
    console.log('[DEBUG] CONVERTAPI_SECRET is set:', !!process.env.CONVERTAPI_SECRET);
    // 2. Use ConvertAPI to convert PDF to images
    let imagePaths = [];
    try {
      console.log('[MENU_EXTRACTION] Sending PDF to ConvertAPI...');
      imagePaths = await pdfToImagesWithConvertAPI(filePath, outputDir);
      console.log('[MENU_EXTRACTION] Downloaded image paths:', imagePaths);
    } catch (convertApiErr) {
      console.error('[MENU_EXTRACTION] ConvertAPI error:', convertApiErr);
      throw new Error('PDF-to-image conversion failed: ' + convertApiErr.message);
    }
    // 3. Send each image to Google Vision OCR
    let fullText = '';
    for (const imgPath of imagePaths) {
      try {
        const [result] = await client.textDetection(imgPath);
        const text = result.fullTextAnnotation?.text || '';
        console.log(`[MENU_EXTRACTION] OCR text for ${imgPath}:`, text.slice(0, 200));
        fullText += text + '\n';
      } catch (visionErr) {
        console.error(`[MENU_EXTRACTION] Google Vision error for ${imgPath}:`, visionErr);
        throw new Error('Google Vision OCR failed: ' + visionErr.message);
      }
      try { fs.unlinkSync(imgPath); } catch {}
    }
    // 4. Cleanup
    fs.unlinkSync(filePath);
    try { fs.rmdirSync(outputDir, { recursive: true }); } catch {}
    // 5. Send text to GPT-4o for menu extraction
    try {
      console.log('[MENU_EXTRACTION] Full OCR text:', fullText.slice(0, 500));
      const systemPrompt = `You are a restaurant menu data extraction assistant.\n\nYour task is to extract all menu items from the provided OCR menu text and return them in a structured table with the following columns:\n\nName\nDescription (only if it clearly refers to a single menu item)\nPrice (numerical, without symbols)\n\n**IMPORTANT:**\n- If a line contains a list of items (comma, slash, or bullet separated), split and create an individual entry for each item, assigning the shared price.\n- Only use a description if it is immediately below and clearly specific to a single item—not a section, group, or general notice.\n- Do not include section headers, allergen information, group titles, or instructions in any item's description.\n- Ignore non-menu text: Do not include footers, headers, page numbers, or irrelevant content.\n- Only include items with both a name and a price.\n\nFormatting:\nOutput as a table with columns: Name | Description | Price\nIf description does not exist for an item, leave it blank.\n\n---\n\nExample input:\nBeverages-Cold\nCoca-Cola, Coke Zero, Sprite, Fanta, Im-Bru. — £2.50\n\nExample output:\nName        | Description | Price\nCoca-Cola   |             | 2.50\nCoke Zero   |             | 2.50\nSprite      |             | 2.50\nFanta       |             | 2.50\nIm-Bru      |             | 2.50\n\nAnother example input:\nVarious Soft Drinks\n£2.50\nCoca-Cola, Sprite, Fanta\n\nExample output:\nName        | Description | Price\nCoca-Cola   |             | 2.50\nSprite      |             | 2.50\nFanta       |             | 2.50\n\nOCR Text:\n${fullText}`;
      const userPrompt = `Extract all menu items from this menu:\n\n${fullText}\n\nRemember: ONLY valid JSON array, no markdown.`;
      const gptResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4096,
        temperature: 0.1,
      });
      const menuItems = gptResponse.choices[0].message.content;
      console.log('[MENU_EXTRACTION] GPT-4o response:', menuItems.slice(0, 500));
      return res.json({ ocrText: fullText, menuItems });
    } catch (gptErr) {
      console.error('[MENU_EXTRACTION] GPT-4o error:', gptErr);
      return res.status(500).json({ error: 'GPT-4o extraction failed', detail: gptErr.message, ocrText: fullText });
    }
  } catch (err) {
    console.error('[MENU_EXTRACTION] General error:', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}

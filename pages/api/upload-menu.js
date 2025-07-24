import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import unzipper from 'unzipper';
import path from 'path';
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

async function extractImagesFromPdf(pdfPath) {
  const cloudmersiveApiKey = process.env.CLOUDMERSIVE_API_KEY;
  const pdfBuffer = fs.readFileSync(pdfPath);
  const response = await axios.post(
    'https://api.cloudmersive.com/convert/pdf/to/jpg',
    pdfBuffer,
    {
      headers: {
        'Apikey': cloudmersiveApiKey,
        'Content-Type': 'application/pdf',
      },
      responseType: 'arraybuffer',
    }
  );
  // Save zip file
  const zipPath = pdfPath + '.zip';
  fs.writeFileSync(zipPath, response.data);
  // Unzip images
  const imagePaths = [];
  await fs.createReadStream(zipPath)
    .pipe(unzipper.Parse())
    .on('entry', function (entry) {
      const fileName = entry.path;
      if (fileName.endsWith('.jpg') || fileName.endsWith('.png')) {
        const outPath = path.join('/tmp', fileName);
        imagePaths.push(outPath);
        entry.pipe(fs.createWriteStream(outPath));
      } else {
        entry.autodrain();
      }
    })
    .promise();
  return imagePaths;
}

export default async function handler(req, res) {
  await runMiddleware(req, res, upload.single('menu'));
  try {
    // 1. Read file
    const filePath = req.file.path;
    console.log('[MENU_EXTRACTION] Uploaded file path:', filePath);
    // 2. Send PDF to Cloudmersive, get images
    let imagePaths;
    try {
      imagePaths = await extractImagesFromPdf(filePath);
      console.log('[MENU_EXTRACTION] Extracted image paths:', imagePaths);
    } catch (cloudmersiveErr) {
      console.error('[MENU_EXTRACTION] Cloudmersive error:', cloudmersiveErr);
      throw new Error('Cloudmersive PDF-to-image conversion failed: ' + cloudmersiveErr.message);
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

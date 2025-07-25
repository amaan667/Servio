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
  console.log('[DEBUG] Service account written to:', keyPath);
  console.log('[DEBUG] GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
  // Optional: log first 200 chars to verify
  console.log('[DEBUG] Contents:', require('fs').readFileSync(keyPath, 'utf8').slice(0, 200) + '...');
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

export default async function handler(req, res) {
  console.log('[MENU_EXTRACTION] Handler start');
  await runMiddleware(req, res, upload.single('menu'));
  try {
    // 1. Read file
    const filePath = req.file.path;
    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
      console.error('[MENU_EXTRACTION] GCS_BUCKET_NAME not set');
      throw new Error('GCS_BUCKET_NAME environment variable is not set.');
    }
    console.log('[MENU_EXTRACTION] Uploaded file path:', filePath);
    console.log('[MENU_EXTRACTION] File exists:', fs.existsSync(filePath), 'Size:', fs.existsSync(filePath) ? fs.statSync(filePath).size : 'N/A');
    // 2. Upload to GCS and run Vision OCR
    let ocrText = '';
    try {
      console.log('[MENU_EXTRACTION] Uploading to GCS...');
      const gcsUri = await uploadToGCS(filePath, bucketName, path.basename(filePath));
      console.log('[MENU_EXTRACTION] Uploaded to GCS URI:', gcsUri);
      console.log('[MENU_EXTRACTION] Starting Vision OCR...');
      ocrText = await ocrPdfWithVision(filePath, bucketName);
      console.log('[MENU_EXTRACTION] OCR text (first 500 chars):', ocrText.slice(0, 500));
    } catch (visionErr) {
      console.error('[MENU_EXTRACTION] Vision OCR error:', visionErr);
      throw new Error('Vision OCR failed: ' + visionErr.message);
    }
    // 3. Cleanup
    try {
      fs.unlinkSync(filePath);
      console.log('[MENU_EXTRACTION] Temp file cleaned up:', filePath);
    } catch (cleanupErr) {
      console.error('[MENU_EXTRACTION] Temp file cleanup error:', cleanupErr);
    }
    // 4. Check for empty/short OCR text
    if (!ocrText || ocrText.length < 50) {
      console.error('[MENU_EXTRACTION] OCR text too short or empty.');
      return res.status(400).json({ error: 'OCR text too short or empty.' });
    }
    // 5. Send text to GPT-4o for menu extraction
    try {
      console.log('[MENU_EXTRACTION] Sending OCR text to GPT-4o...');
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
        const prompt = `Extract all menu items and prices from the following text.\nReturn ONLY a JSON object with a 'menuItems' key whose value is an array of items. Each item should have name, description, price, category.\n\nText:\n${chunk}`;
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
      console.log('[MENU_EXTRACTION] Cleaned & deduped menuItems:', allMenuItems);
      console.log('API RESPONSE JSON:', JSON.stringify({ menuItems: allMenuItems, ocrText, chunkErrors }));
      if (!Array.isArray(allMenuItems) || allMenuItems.length === 0) {
        console.error('[MENU_EXTRACTION] Menu array is empty or invalid after merging:', allMenuItems);
        return res.status(500).json({ error: 'Menu array is empty or invalid after merging', menuItems: allMenuItems, chunkErrors });
      }
      return res.json({ ocrText, menuItems: allMenuItems, chunkErrors });
    } catch (gptErr) {
      console.error('[MENU_EXTRACTION] GPT-4o error:', gptErr);
      return res.status(500).json({ error: 'GPT-4o extraction failed', detail: gptErr.message, ocrText });
    }
  } catch (err) {
    console.error('MENU_EXTRACTION FINAL ERROR:', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}

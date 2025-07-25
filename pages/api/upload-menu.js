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
      const prompt = `Extract all menu items and prices from the following menu text.\nOutput ONLY a valid JSON array. Do NOT include any explanation or text, only the array. No trailing commas, no comments, no code fences.\nArray example: [{\"name\":\"Example\",\"description\":\"\",\"price\":4.5}]\nMenu text:\n${ocrText}`;
      const gptResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
      });
      // After receiving the GPT-4o response
      const gptOutputRaw = gptResponse.choices[0].message.content.trim();
      console.log('[MENU_EXTRACTION] Raw GPT-4o output:', gptOutputRaw);
      // Remove code fences if present
      let gptOutput = gptOutputRaw;
      if (gptOutput.startsWith('```json')) {
        gptOutput = gptOutput.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (gptOutput.startsWith('```')) {
        gptOutput = gptOutput.replace(/^```/, '').replace(/```$/, '').trim();
      }
      let menuItems;
      try {
        menuItems = JSON.parse(gptOutput);
        console.log('[MENU_EXTRACTION] Parsed menuItems:', menuItems);
      } catch (err) {
        // Try to repair the JSON if parsing fails
        try {
          menuItems = JSON.parse(jsonrepair(gptOutput));
          console.log('[MENU_EXTRACTION] Parsed menuItems after repair:', menuItems);
        } catch (repairErr) {
          console.error('[MENU_EXTRACTION] Failed to repair/parse GPT output:', gptOutput, repairErr);
          return res.status(500).json({ error: 'Failed to parse/repair GPT-4o output', gptOutput, details: repairErr.message });
        }
      }
      // Validate menuItems is a proper array with required fields
      if (!Array.isArray(menuItems) || menuItems.length === 0 || !menuItems.every(i => i && typeof i === 'object' && i.name && i.price)) {
        console.error('[MENU_EXTRACTION] Parsed menuItems is not a valid array:', menuItems);
        return res.status(500).json({ error: 'Parsed menuItems is not a valid array', menuItems });
      }
      console.log('[MENU_EXTRACTION] GPT-4o output (first 500 chars):', JSON.stringify(menuItems).slice(0, 500));
      console.log('[MENU_EXTRACTION] Handler about to return');
      return res.json({ ocrText, menuItems });
    } catch (gptErr) {
      console.error('[MENU_EXTRACTION] GPT-4o error:', gptErr);
      return res.status(500).json({ error: 'GPT-4o extraction failed', detail: gptErr.message, ocrText });
    }
  } catch (err) {
    console.error('[MENU_EXTRACTION] General error:', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}

import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { PdfConverter } from 'pdf-poppler';
import { createWorker } from 'tesseract.js';
import { createClient } from '@supabase/supabase-js';

const upload = multer({ dest: '/tmp/uploads' });

export const config = { api: { bodyParser: false } };

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default function handler(req, res) {
  upload.single('menu')(req, res, async (err) => {
    if (err) return res.status(500).json({ error: 'File upload failed' });

    const filePath = req.file.path;
    const mime = req.file.mimetype;
    const venueId = req.body.venueId || req.query.venueId;

    try {
      const isPDF = mime === 'application/pdf';
      const text = isPDF
        ? await extractTextFromPDF(filePath)
        : await extractTextFromImage(filePath);

      // Parse text to structured items (using GPT-4)
      const items = await parseMenuWithGPT(text);

      // Insert items into DB
      if (venueId && items.length > 0) {
        await supabase.from('menu_items').insert(
          items.map(item => ({
            ...item,
            venue_id: venueId,
            available: true,
            created_at: new Date().toISOString(),
          }))
        );
      }

      return res.status(200).json({ success: true, items });
    } catch (e) {
      console.error("OCR error:", e);
      return res.status(500).json({ error: 'OCR failed' });
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });
}

async function extractTextFromPDF(pdfPath) {
  const outputDir = path.join('/tmp', `pdf-${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });

  await PdfConverter.convert(pdfPath, {
    format: 'png',
    out_dir: outputDir,
    out_prefix: 'page',
    page: null,
  });

  const images = fs.readdirSync(outputDir).filter(f => f.endsWith('.png'));
  const texts = [];

  for (const img of images) {
    const imgPath = path.join(outputDir, img);
    const text = await extractTextFromImage(imgPath);
    texts.push(text);
    fs.unlinkSync(imgPath);
  }

  fs.rmdirSync(outputDir);
  return texts.join('\n\n');
}

async function extractTextFromImage(imagePath) {
  const worker = await createWorker('eng');
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  const { data: { text } } = await worker.recognize(imagePath);
  await worker.terminate();
  return text;
}

async function parseMenuWithGPT(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  const prompt = `Extract all menu items from the following restaurant menu text. For each item, return a JSON object with fields: name, price (number), category (if available), and description (if available). Return a JSON array.\n\nMenu text:\n${text}\n\nJSON:`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that extracts structured menu data from unstructured text.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    }),
  });
  const gptJSON = await response.json();
  try {
    return JSON.parse(gptJSON.choices[0].message.content);
  } catch {
    return [];
  }
} 
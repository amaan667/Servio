import multer from 'multer';
import fs from 'fs';
import { createWorker } from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

const upload = multer({ dest: '/tmp/uploads' });

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default function handler(req, res) {
  console.log("🔥 OCR handler loaded: build 2025-07-18@14:02 - DEPLOYMENT CONFIRMED");
  upload.single('menu')(req, res, async (err) => {
    if (err) return res.status(500).json({ error: 'Upload failed' });

    const filePath = req.file.path;
    const mime = req.file.mimetype;
    const venueId = req.body.venueId || req.query.venueId;

    try {
      let text = '';
      if (mime === 'application/pdf') {
        text = await extractTextFromPDF(filePath);
      } else {
        text = await extractTextFromImage(filePath);
      }

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

      res.status(200).json({ items });
    } catch (e) {
      console.error('OCR error:', e);
      res.status(500).json({ error: 'OCR failed' });
    } finally {
      fs.unlinkSync(filePath);
    }
  });
}

async function extractTextFromPDF(pdfPath) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const texts = [];

  for (const page of pages) {
    // Use pdf-lib's text extraction for digital/text PDFs
    const textContent = await page.getTextContent?.();
    if (textContent && textContent.items) {
      texts.push(textContent.items.map(item => item.str).join(' '));
    } else if (page.getText) {
      texts.push(page.getText());
    } else {
      // Fallback: just push an empty string for this page
      texts.push('');
    }
  }

  return texts.join('\n\n');
}

async function extractTextFromImage(imagePath) {
  const worker = await createWorker('eng');
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  const {
    data: { text },
  } = await worker.recognize(imagePath);
  await worker.terminate();
  return text;
}

async function parseMenuWithGPT(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
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
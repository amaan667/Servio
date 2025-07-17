import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { uploadPDFToGCS, runVisionOCR, readOCRResult } from '@/lib/menuOcrHelpers';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const outputBucket = process.env.GCS_OUTPUT_BUCKET!;

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { base64, mimetype, filename } = req.body;
    if (!base64 || !mimetype || !filename) {
      return res.status(400).json({ error: 'Missing base64, mimetype, or filename' });
    }

    // Decode base64 and save to temp file
    const buffer = Buffer.from(base64, 'base64');
    const tempFilePath = path.join('/tmp', `${Date.now()}-${filename}`);
    await writeFile(tempFilePath, buffer);

    // Upload to GCS
    const fileName = `menus/${Date.now()}-${filename}`;
    const gcsInputUri = await uploadPDFToGCS(tempFilePath, fileName);

    // Construct output URI
    const gcsOutputUri = `gs://${outputBucket}/${fileName}/`;

    // Run OCR (returns void)
    await runVisionOCR(gcsInputUri, gcsOutputUri);

    // Read OCR result (returns text)
    const ocrText = await readOCRResult(gcsOutputUri);

    // Clean up temp file
    await unlink(tempFilePath);

    // Send to OpenAI for structuring
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: `Extract and return this restaurant menu in JSON array format. Each item should have: name, description, price, and category.\n\n${ocrText}`,
          },
        ],
        temperature: 0.2,
      }),
    });
    const gptJSON = await openaiRes.json();
    let items = null;
    let gptRaw = '';
    try {
      gptRaw = gptJSON.choices?.[0]?.message?.content || '';
      items = JSON.parse(gptRaw);
    } catch (e) {
      // fallback: try to extract JSON from the string
      try {
        // Extract JSON array from the string (across newlines)
        const match = gptRaw.match(/\[[\s\S]*\]/);
        if (match) items = JSON.parse(match[0]);
      } catch (e2) {
        items = null;
      }
    }

    if (!items) {
      return res.status(200).json({ success: true, ocrText, items: [], gptRaw, error: 'Failed to parse structured menu from GPT' });
    }

    res.status(200).json({ success: true, ocrText, items });
  } catch (err: any) {
    console.error('Upload/parse error:', err);
    res.status(500).json({ error: 'Failed to process file', details: err?.message || String(err) });
  }
} 
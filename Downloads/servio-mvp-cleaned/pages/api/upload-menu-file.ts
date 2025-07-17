import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { runDocumentAI, uploadPDFToGCS } from '@/lib/menuOcrHelpers';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const outputBucket = process.env.GCS_OUTPUT_BUCKET!;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

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
    const gcsInputUri = await uploadPDFToGCS(tempFilePath, fileName, mimetype);
    console.log("Calling runDocumentAI with input URI:", gcsInputUri);

    // Use Document AI for extraction
    let ocrText = '';
    try {
      ocrText = await runDocumentAI(gcsInputUri, mimetype || "application/pdf");
      console.log('Extracted OCR text length:', ocrText.length);
      console.log('Extracted OCR text (truncated):', ocrText.slice(0, 500));
    } catch (ocrErr) {
      console.error('Document AI extraction error:', ocrErr);
      await unlink(tempFilePath);
      return res.status(500).json({ error: 'Failed to extract text from file (Document AI step failed).', details: (ocrErr as any)?.message || String(ocrErr) });
    }

    // Clean up temp file
    await unlink(tempFilePath);

    // If OCR text is empty or too short, return a user-friendly error
    if (!ocrText || ocrText.length < 50) {
      return res.status(400).json({ error: 'Document AI failed: No text extracted from file. Please upload a clearer or different file.' });
    }

    // Prepare prompt for GPT
    const prompt = `Extract and return this restaurant menu as a JSON array. Each item should have: name, description, price, and category. Return ONLY the JSON array, no commentary or markdown.\n\n${ocrText}`;

    // Log the prompt sent to GPT (truncate for privacy/log size)
    console.log('GPT prompt (truncated):', prompt.slice(0, 500));

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
            content: prompt,
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
      // Log the raw GPT response (truncate for log size)
      console.log('GPT raw response (truncated):', gptRaw.slice(0, 500));
      // Remove markdown/code fences
      const clean = gptRaw.replace(/```json|```/g, '').trim();
      // Extract JSON array/object
      const match = clean.match(/\[[\s\S]*\]/) || clean.match(/\{[\s\S]*\}/);
      if (match) items = JSON.parse(match[0]);
      else items = JSON.parse(clean);
    } catch (e) {
      console.error('Failed to parse GPT response:', gptRaw, e);
      items = null;
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
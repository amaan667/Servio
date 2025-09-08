import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

/**
 * Render a PDF (or single-image bytes) to images and OCR to text.
 * - Uses 220 DPI, grayscale, normalize and threshold to aid OCR
 * - Limits to first `maxPages` pages for cost/perf
 */
export async function ocrPdfToText(pdfBuffer: Buffer, maxPages = 5): Promise<string> {
  const texts: string[] = [];
  let pageIndex = 0;
  // If buffer is an image (not a multi-page PDF), sharp will still handle it; we try page loop with try/catch
  const worker = await createWorker() as any;
  try {
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    // PSM 6: Assume a single uniform block of text
    await worker.setParameters({ tessedit_pageseg_mode: '6' as any });

    while (pageIndex < maxPages) {
      try {
        const raster = await sharp(pdfBuffer, { density: 220, page: pageIndex })
          .grayscale()
          .normalize()
          .threshold(180)
          .toFormat('png')
          .toBuffer();

        const { data } = await worker.recognize(raster);
        const cleaned = (data?.text || '')
          .replace(/[\u2500-\u257F]+/g, ' ') // box-drawing chars
          .replace(/[\r\t]+/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();
        texts.push(cleaned);
      } catch (err) {
        // No more pages or decoding failed for this page
        break;
      }
      pageIndex += 1;
    }
  } finally {
    try { await worker.terminate(); } catch {}
  }

  return texts.filter(Boolean).join('\n');
}

export default ocrPdfToText;



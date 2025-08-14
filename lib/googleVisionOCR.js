import vision from '@google-cloud/vision';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

const bucketName = process.env.GCS_BUCKET_NAME;

// Google clients
const client = new vision.ImageAnnotatorClient();
const storage = new Storage();

/**
 * Uploads a PDF to GCS and runs Google Vision OCR
 * Returns the combined text from all pages in reading order
 */
export async function extractTextFromPdf(pdfBuffer, fileName) {
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME environment variable is required');
  }

  const tempFileName = `${uuidv4()}-${fileName}`;
  const gcsUri = `gs://${bucketName}/${tempFileName}`;

  console.log('[OCR] Starting Google Vision OCR process...');
  console.log('[OCR] Bucket:', bucketName);
  console.log('[OCR] File:', tempFileName);

  try {
    // Upload to GCS
    await storage.bucket(bucketName).file(tempFileName).save(pdfBuffer);
    console.log(`[OCR] Uploaded PDF to ${gcsUri}`);

    // Run OCR on the PDF
    const [operation] = await client.asyncBatchAnnotateFiles({
      requests: [
        {
          inputConfig: {
            mimeType: 'application/pdf',
            gcsSource: { uri: gcsUri }
          },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          outputConfig: {
            gcsDestination: { uri: `gs://${bucketName}/ocr-output/${tempFileName}/` },
            batchSize: 1
          }
        }
      ]
    });

    console.log(`[OCR] Processing started...`);
    await operation.promise();
    console.log(`[OCR] Processing complete.`);

    // Download OCR JSON output
    const [files] = await storage.bucket(bucketName).getFiles({
      prefix: `ocr-output/${tempFileName}/`
    });

    let fullText = '';

    for (const file of files) {
      const [contents] = await file.download();
      const parsed = JSON.parse(contents.toString('utf8'));
      parsed.responses.forEach(page => {
        if (page.fullTextAnnotation?.text) {
          fullText += page.fullTextAnnotation.text + '\n';
        }
      });
    }

    console.log(`[OCR] Extracted text length: ${fullText.length}`);
    console.log(`[OCR] Text preview:`, fullText.substring(0, 200));

    // Clean up temporary files
    try {
      await storage.bucket(bucketName).file(tempFileName).delete();
      console.log(`[OCR] Cleaned up temporary file: ${tempFileName}`);
    } catch (cleanupError) {
      console.warn(`[OCR] Failed to cleanup temporary file:`, cleanupError.message);
    }

    return fullText.trim();
  } catch (error) {
    console.error('[OCR] Error during OCR process:', error);
    throw error;
  }
}

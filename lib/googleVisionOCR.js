import vision from '@google-cloud/vision';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

const bucketName = process.env.GCS_BUCKET_NAME;

// Google clients with Railway-compatible credentials
let client, storage;

try {

  // For Railway: handle base64 encoded credentials
  if (process.env.GOOGLE_CREDENTIALS_B64) {
    storage = new Storage({ 
      credentials,
      projectId: process.env.GOOGLE_PROJECT_ID 
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    storage = new Storage({ 
      credentials,
      projectId: process.env.GOOGLE_PROJECT_ID 
    });
  } else {
    storage = new Storage({
      projectId: process.env.GOOGLE_PROJECT_ID
    });
  }
  
} catch (error) {
  console.error('[OCR] Failed to initialize Google Cloud clients:', error);
  throw new Error(`Google Cloud credentials not properly configured: ${error.message}`);
}

/**
 * Uploads a PDF to GCS and runs Google Vision OCR
 * Returns the combined text from all pages in reading order
 */
export async function extractTextFromPdf(pdfBuffer, fileName) {
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME environment variable is required');
  }

  if (!process.env.GOOGLE_PROJECT_ID) {
    throw new Error('GOOGLE_PROJECT_ID environment variable is required');
  }

  const tempFileName = `${uuidv4()}-${fileName}`;
  const gcsUri = `gs://${bucketName}/${tempFileName}`;

  // [AUTH DEBUG] Starting Google Vision OCR process...
  // [AUTH DEBUG] Project ID:', process.env.GOOGLE_PROJECT_ID
  // [AUTH DEBUG] Bucket:', bucketName
  // [AUTH DEBUG] File:', tempFileName

  try {
    // Upload to GCS
    await storage.bucket(bucketName).file(tempFileName).save(pdfBuffer);
    // [AUTH DEBUG] Uploaded PDF to ${gcsUri}

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

    // [AUTH DEBUG] Processing started...
    await operation.promise();
    // [AUTH DEBUG] Processing complete.

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

    // [AUTH DEBUG] Extracted text length: ${fullText.length}
    // [AUTH DEBUG] Text preview:', fullText.substring(0, 200)

    // Clean up temporary files
    try {
      await storage.bucket(bucketName).file(tempFileName).delete();
      // [AUTH DEBUG] Cleaned up temporary file: ${tempFileName}
    } catch (cleanupError) {
      console.warn(`[OCR] Failed to cleanup temporary file:`, cleanupError.message);
    }

    return fullText.trim();
  } catch (error) {
    console.error('[OCR] Error during OCR process:', error);
    throw error;
  }
}

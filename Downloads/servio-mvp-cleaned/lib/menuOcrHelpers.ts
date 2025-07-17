// Write Google service account key to disk for serverless environments
if (process.env.GCLOUD_SERVICE_KEY) {
  const key = JSON.parse(process.env.GCLOUD_SERVICE_KEY);
  require("fs").writeFileSync("/tmp/gcloud-key.json", JSON.stringify(key));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/gcloud-key.json";
}

import { Storage } from "@google-cloud/storage";
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { logger } from "./logger";

const bucketName = process.env.GCS_BUCKET!;
const outputBucket = process.env.GCS_OUTPUT_BUCKET!;

const storage = new Storage();

// Document AI config
const projectId = process.env.GCLOUD_PROJECT_ID!;
const location = process.env.DOCUMENT_AI_LOCATION || 'us';
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID!; // e.g. "YOUR_PROCESSOR_ID"
const documentAiClient = new DocumentProcessorServiceClient();

export async function uploadPDFToGCS(filePath: string, fileName: string): Promise<string> {
  logger.info("Uploading file to GCS", { filePath, fileName, bucketName });
  try {
    await storage.bucket(bucketName).upload(filePath, {
      destination: fileName,
      contentType: "application/pdf",
    });
    const uri = `gs://${bucketName}/${fileName}`;
    logger.info("File uploaded to GCS", { uri });
    return uri;
  } catch (error: any) {
    logger.error("Failed to upload file to GCS", { error });
    throw new Error("GCS upload failed: " + (error.message || error));
  }
}

export async function runDocumentAI(gcsInputUri: string): Promise<string> {
  logger.info("Starting Document AI batch process", { gcsInputUri, processorId, projectId, location });
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
  const request = {
    name,
    rawDocument: undefined,
    inputDocuments: {
      gcsPrefix: {
        gcsUriPrefix: gcsInputUri,
      },
    },
    documentOutputConfig: undefined,
  };
  try {
    const [result] = await documentAiClient.batchProcessDocuments(request);
    logger.info("Document AI batch process started", { operation: result.name });
    await result.promise();
    logger.info("Document AI batch process completed", { operation: result.name });
    // Download and parse the output from GCS
    return await readOCRResult(gcsInputUri.replace(bucketName, outputBucket));
  } catch (error: any) {
    logger.error("Document AI extraction failed", { error });
    throw new Error("Document AI step failed: " + (error.message || error));
  }
}

export async function readOCRResult(gcsOutputUri: string): Promise<string> {
  logger.info("Reading OCR result from GCS", { gcsOutputUri });
  try {
    const [_, bucket, ...prefixArr] = gcsOutputUri.replace("gs://", "").split("/");
    const prefix = prefixArr.join("/");
    const [files] = await storage.bucket(bucket).getFiles({ prefix });
    logger.info("Found OCR result files", { fileCount: files.length, files: files.map(f => f.name) });
    let allText = "";
    for (const file of files) {
      const [content] = await file.download();
      const json = JSON.parse(content.toString());
      if (json.responses && json.responses[0]?.fullTextAnnotation?.text) {
        allText += json.responses[0].fullTextAnnotation.text + "\n";
      }
    }
    logger.info("Extracted text from OCR result", { textLength: allText.length });
    return allText.trim();
  } catch (error: any) {
    logger.error("Failed to read OCR result from GCS", { error });
    throw new Error("Failed to read OCR result: " + (error.message || error));
  }
} 
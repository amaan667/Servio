// Trivial change: trigger redeploy
// Write Google service account key to disk for serverless environments
if (process.env.GCLOUD_SERVICE_KEY) {
  const key = JSON.parse(process.env.GCLOUD_SERVICE_KEY);
  require("fs").writeFileSync("/tmp/gcloud-key.json", JSON.stringify(key));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/gcloud-key.json";
  // Add logging for debugging
  console.log("Service account key written to /tmp/gcloud-key.json");
  console.log("GOOGLE_APPLICATION_CREDENTIALS set to:", process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

import { Storage } from "@google-cloud/storage";
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { logger } from "./logger";
import { readFile } from "fs/promises";

const bucketName = process.env.GCS_BUCKET!;
const outputBucket = process.env.GCS_OUTPUT_BUCKET!;

const storage = new Storage();

// Document AI config
const projectId = process.env.GCLOUD_PROJECT_ID!;
const location = process.env.DOCUMENT_AI_LOCATION || 'us';
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID!; // e.g. "YOUR_PROCESSOR_ID"
const documentAiClient = new DocumentProcessorServiceClient();

export async function uploadPDFToGCS(filePath: string, fileName: string, mimetype: string): Promise<string> {
  logger.info("Uploading file to GCS", { filePath, fileName, bucketName, mimetype });
  try {
    await storage.bucket(bucketName).upload(filePath, {
      destination: fileName,
      contentType: mimetype,
    });
    const uri = `gs://${bucketName}/${fileName}`;
    logger.info("File uploaded to GCS", { uri, mimetype });
    console.log("GCS Input URI:", uri); // Always log GCS URI
    return uri;
  } catch (error: any) {
    logger.error("Failed to upload file to GCS", { error });
    throw new Error("GCS upload failed: " + (error.message || error));
  }
}

// NOTE: Processor must be an OCR Processor (DOCUMENT_TEXT_DETECTION)
// Input file names should have no spaces, special characters, or parentheses
export async function runDocumentAI(gcsInputUri: string, mimeType: string = "application/pdf"): Promise<string> {
  // Minimal, working Document AI processDocument request for a single file
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
  const request = {
    name,
    document: {
      gcsUri: gcsInputUri,
      mimeType,
    },
  };
  console.log("🚨 FINAL payload being sent to Document AI:");
  console.log(JSON.stringify(request, null, 2));
  try {
    const [result] = await documentAiClient.processDocument(request);
    // Access text via result.document.text
    return result.document?.text || "";
  } catch (error: any) {
    console.error("Document AI extraction failed", error, request);
    throw new Error("Document AI step failed: " + (error.message || error));
  }
}

export async function runDocumentAIFromLocalBuffer(filePath: string, mimeType: string = "application/pdf"): Promise<string> {
  const projectId = process.env.GCLOUD_PROJECT_ID || "alien-scope-440914-a7";
  const location = process.env.DOCUMENT_AI_LOCATION || "eu";
  const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID || "60d448e349618384";
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  const fileBuffer = await readFile(filePath);

  const requestPayload = {
    name,
    rawDocument: {
      content: fileBuffer.toString("base64"),
      mimeType,
    },
  };

  console.log("🚨 FINAL payload being sent to Document AI (rawDocument):");
  console.log(JSON.stringify({ ...requestPayload, rawDocument: { ...requestPayload.rawDocument, content: '[base64 omitted]' } }, null, 2));

  const [result] = await documentAiClient.processDocument(requestPayload);
  const extractedText = result?.document?.text || "";
  console.log("✅ Extracted text:", extractedText.slice(0, 500)); // Preview
  return extractedText;
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
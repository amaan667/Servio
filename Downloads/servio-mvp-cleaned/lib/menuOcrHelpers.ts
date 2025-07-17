// Write Google service account key to disk for serverless environments
if (process.env.GCLOUD_SERVICE_KEY) {
  const key = JSON.parse(process.env.GCLOUD_SERVICE_KEY);
  require("fs").writeFileSync("/tmp/gcloud-key.json", JSON.stringify(key));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/gcloud-key.json";
}

import { Storage } from "@google-cloud/storage";
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

const bucketName = process.env.GCS_BUCKET!;
const outputBucket = process.env.GCS_OUTPUT_BUCKET!;

const storage = new Storage();

// Document AI config
const projectId = process.env.GCLOUD_PROJECT_ID!;
const location = process.env.DOCUMENT_AI_LOCATION || 'us';
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID!; // e.g. "YOUR_PROCESSOR_ID"
const documentAiClient = new DocumentProcessorServiceClient();

export async function uploadPDFToGCS(filePath: string, fileName: string): Promise<string> {
  await storage.bucket(bucketName).upload(filePath, {
    destination: fileName,
    contentType: "application/pdf",
  });
  return `gs://${bucketName}/${fileName}`;
}

export async function runDocumentAI(gcsInputUri: string): Promise<string> {
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
  const [result] = await documentAiClient.batchProcessDocuments(request);
  // Wait for operation to complete
  await result.promise();
  // Download and parse the output from GCS
  return await readOCRResult(gcsInputUri.replace(bucketName, outputBucket));
}

export async function readOCRResult(gcsOutputUri: string): Promise<string> {
  // gcsOutputUri: gs://output-bucket/results/...
  const [_, bucket, ...prefixArr] = gcsOutputUri.replace("gs://", "").split("/");
  const prefix = prefixArr.join("/");
  const [files] = await storage.bucket(bucket).getFiles({ prefix });
  let allText = "";
  for (const file of files) {
    const [content] = await file.download();
    const json = JSON.parse(content.toString());
    if (json.responses && json.responses[0]?.fullTextAnnotation?.text) {
      allText += json.responses[0].fullTextAnnotation.text + "\n";
    }
  }
  return allText.trim();
} 
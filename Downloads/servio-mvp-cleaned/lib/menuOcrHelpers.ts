import { Storage } from "@google-cloud/storage";
import { v1 as vision } from "@google-cloud/vision";

const bucketName = process.env.GCS_BUCKET!;
const outputBucket = process.env.GCS_OUTPUT_BUCKET!;

const storage = new Storage();
const visionClient = new vision.ImageAnnotatorClient();

export async function uploadPDFToGCS(filePath: string, fileName: string): Promise<string> {
  await storage.bucket(bucketName).upload(filePath, {
    destination: fileName,
    contentType: "application/pdf",
  });
  return `gs://${bucketName}/${fileName}`;
}

export async function runVisionOCR(gcsInputUri: string, gcsOutputUri: string) {
  const request = {
    requests: [
      {
        inputConfig: {
          mimeType: "application/pdf",
          gcsSource: { uri: gcsInputUri },
        },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        outputConfig: {
          gcsDestination: { uri: gcsOutputUri },
          batchSize: 2,
        },
      },
    ],
  };
  const [operation] = await visionClient.asyncBatchAnnotateFiles(request);
  await operation.promise(); // Wait for completion
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
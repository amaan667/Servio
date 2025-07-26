// Usage: node scripts/ocr_pdf_with_vision_and_gpt.js <pdfPath> <gcsBucket>
// Requires: @google-cloud/vision, @google-cloud/storage, openai
// Set GOOGLE_APPLICATION_CREDENTIALS env var or use keyFilename in client options
// Set OPENAI_API_KEY in your environment

const vision = require('@google-cloud/vision');
const { Storage } = require('@google-cloud/storage');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function uploadToGCS(localPath, bucketName, destFileName) {
    const storage = new Storage();
    await storage.bucket(bucketName).upload(localPath, { destination: destFileName });
    return `gs://${bucketName}/${destFileName}`;
}

async function ocrPdfWithVision(pdfPath, bucketName) {
    const client = new vision.ImageAnnotatorClient();
    const gcsSourceUri = await uploadToGCS(pdfPath, bucketName, path.basename(pdfPath));
    const gcsDestinationUri = `gs://${bucketName}/ocr-results/`;

    const inputConfig = { mimeType: 'application/pdf', gcsSource: { uri: gcsSourceUri } };
    const outputConfig = { gcsDestination: { uri: gcsDestinationUri } };

    const [operation] = await client.asyncBatchAnnotateFiles({
        requests: [{
            inputConfig,
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            outputConfig,
        }],
    });

    console.log('Processing PDF with Vision OCR...');
    await operation.promise();

    // Download the output JSON from GCS
    const storage = new Storage();
    const [files] = await storage.bucket(bucketName).getFiles({ prefix: 'ocr-results/' });
    let ocrText = '';
    for (const file of files) {
        if (file.name.endsWith('.json')) {
            const contents = await file.download();
            const json = JSON.parse(contents[0].toString());
            ocrText += json.responses.map(r => r.fullTextAnnotation?.text || '').join('\n');
        }
    }
    return ocrText;
}

async function extractMenuWithGpt(ocrText) {
    const prompt = `Extract all menu items and prices from the following menu text.\nOutput as JSON array: [{ "name": ..., "description": ..., "price": ..., "category": ... }]\nMenu text:\n${ocrText}`;
    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
    });
    return completion.choices[0].message.content;
}

// Main CLI usage
(async () => {
    const pdfPath = process.argv[2];
    const bucketName = process.argv[3];
    if (!pdfPath || !bucketName) {
        console.error('Usage: node scripts/ocr_pdf_with_vision_and_gpt.js <pdfPath> <gcsBucket>');
        process.exit(1);
    }
    const ocrText = await ocrPdfWithVision(pdfPath, bucketName);
    console.log('OCR text (first 500 chars):', ocrText.slice(0, 500));
    const menuJson = await extractMenuWithGpt(ocrText);
    console.log('GPT-4o output:', menuJson);
})(); 